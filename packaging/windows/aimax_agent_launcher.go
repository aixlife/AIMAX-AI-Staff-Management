package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	launcherVersion    = "v1.0.33"
	mutexName          = `Local\AIMAX.LocalAgent`
	requestDirName     = "NaverBlogAuto"
	requestFileName    = "aimax-local-agent-request.json"
	lockFileName       = "aimax-local-agent.lock"
	diagnosticsDirName = "AIMAX"
	errorAlreadyExists = 183
	stillActive        = 259
)

var (
	kernel32                      = syscall.NewLazyDLL("kernel32.dll")
	user32                        = syscall.NewLazyDLL("user32.dll")
	procCreateMutex               = kernel32.NewProc("CreateMutexW")
	procReleaseMutex              = kernel32.NewProc("ReleaseMutex")
	procCloseHandle               = kernel32.NewProc("CloseHandle")
	procOpenProcess               = kernel32.NewProc("OpenProcess")
	procGetExitCodeProcess        = kernel32.NewProc("GetExitCodeProcess")
	procQueryFullProcessImageName = kernel32.NewProc("QueryFullProcessImageNameW")
	procMessageBox                = user32.NewProc("MessageBoxW")
)

type launcherDiagnostic struct {
	Timestamp          string `json:"timestamp"`
	LauncherVersion    string `json:"launcher_version"`
	Stage              string `json:"stage"`
	Kind               string `json:"kind"`
	PID                int    `json:"pid"`
	ProtocolURLPresent bool   `json:"protocol_url_present"`
	CoreExeName        string `json:"core_exe_name,omitempty"`
	Message            string `json:"message,omitempty"`
}

type requestPayload struct {
	Kind      string  `json:"kind"`
	PID       int     `json:"pid"`
	Timestamp float64 `json:"timestamp"`
	Source    string  `json:"source"`
	URL       string  `json:"url,omitempty"`
}

func main() {
	args := os.Args[1:]
	kind := requestKind(args)
	url := protocolURL(args)
	writeDiagnostic("launcher_started", kind, url != "", "", "")

	if running, pid, exePath := existingCoreFromLock(); running {
		_ = writeRequest(kind, url)
		writeDiagnostic("core_already_running_lock", kind, url != "", filepath.Base(exePath), fmt.Sprintf("pid=%d", pid))
		showAlreadyRunningMessage()
		return
	}

	mutex, alreadyRunning, err := acquireAgentMutex()
	if err != nil {
		_ = writeRequest(kind, url)
		writeDiagnostic("mutex_failed", kind, url != "", "", err.Error())
		showMessage("AIMAX 실행기 오류", "AIMAX 실행기 상태를 확인하지 못했습니다.\n웹앱에서 오류 보고를 보내주시면 확인하겠습니다.")
		os.Exit(1)
	}
	if alreadyRunning {
		closeHandle(mutex)
		_ = writeRequest(kind, url)
		writeDiagnostic("mutex_already_running", kind, url != "", "", "request written for existing runner")
		showAlreadyRunningMessage()
		return
	}
	defer releaseMutex(mutex)

	coreExe, err := detectCoreExe()
	if err != nil {
		_ = writeRequest(kind, url)
		writeDiagnostic("core_missing", kind, url != "", "", err.Error())
		showMessage("AIMAX 실행기 오류", "AIMAX 본체 실행 파일을 찾지 못했습니다.\n최신 설치 파일로 다시 설치한 뒤 웹앱에서 오류 보고를 보내주세요.")
		os.Exit(2)
	}
	writeDiagnostic("core_detected", kind, url != "", filepath.Base(coreExe), "")

	_ = writeRequest(kind, url)
	writeDiagnostic("request_written", kind, url != "", filepath.Base(coreExe), "")
	childArgs := []string{"--agent", cliFlagForKind(kind)}
	if url != "" {
		childArgs = append(childArgs, url)
	}
	cmd := exec.Command(coreExe, childArgs...)
	cmd.Dir = filepath.Dir(coreExe)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		writeDiagnostic("core_start_failed", kind, url != "", filepath.Base(coreExe), err.Error())
		showMessage("AIMAX 실행기 오류", "AIMAX 실행기를 시작하지 못했습니다.\n웹앱에서 오류 보고를 보내주시면 설치 상태를 확인하겠습니다.")
		os.Exit(3)
	}
	writeDiagnostic("core_started", kind, url != "", filepath.Base(coreExe), fmt.Sprintf("pid=%d", cmd.Process.Pid))

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()
	select {
	case err := <-done:
		if err != nil {
			var exitErr *exec.ExitError
			if errors.As(err, &exitErr) {
				writeDiagnostic("core_exited_quickly", kind, url != "", filepath.Base(coreExe), fmt.Sprintf("exit_code=%d", exitErr.ExitCode()))
				showMessage("AIMAX 실행기 종료", "AIMAX 실행기가 바로 종료되었습니다.\n웹앱에서 오류 보고를 보내주시면 실행 로그를 확인하겠습니다.")
				os.Exit(exitErr.ExitCode())
			}
			writeDiagnostic("core_exited_quickly", kind, url != "", filepath.Base(coreExe), err.Error())
			showMessage("AIMAX 실행기 종료", "AIMAX 실행기가 바로 종료되었습니다.\n웹앱에서 오류 보고를 보내주시면 실행 로그를 확인하겠습니다.")
			os.Exit(4)
		}
		writeDiagnostic("core_exited_quickly", kind, url != "", filepath.Base(coreExe), "exit_code=0")
		showMessage("AIMAX 실행기 종료", "AIMAX 실행기가 바로 종료되었습니다.\n웹앱에서 연결 버튼을 다시 눌러보고, 계속되면 오류 보고를 보내주세요.")
	case <-time.After(8 * time.Second):
		writeDiagnostic("launcher_handoff", kind, url != "", filepath.Base(coreExe), "core still running after startup window")
		showMessage("AIMAX 실행기가 시작되었습니다.", "AIMAX 실행기가 열렸습니다.\n웹페이지로 돌아가 실행기 연결 상태를 확인해주세요.")
	}
}

func acquireAgentMutex() (syscall.Handle, bool, error) {
	namePtr, err := syscall.UTF16PtrFromString(mutexName)
	if err != nil {
		return 0, false, err
	}
	handle, _, callErr := procCreateMutex.Call(0, 1, uintptr(unsafe.Pointer(namePtr)))
	if handle == 0 {
		if callErr != syscall.Errno(0) {
			return 0, false, callErr
		}
		return 0, false, fmt.Errorf("CreateMutexW returned null handle")
	}
	return syscall.Handle(handle), callErr == syscall.Errno(errorAlreadyExists), nil
}

func releaseMutex(handle syscall.Handle) {
	if handle == 0 {
		return
	}
	procReleaseMutex.Call(uintptr(handle))
	closeHandle(handle)
}

func closeHandle(handle syscall.Handle) {
	if handle == 0 {
		return
	}
	procCloseHandle.Call(uintptr(handle))
}

func detectCoreExe() (string, error) {
	self, err := os.Executable()
	if err != nil {
		return "", err
	}
	appDir := filepath.Dir(self)
	for _, name := range []string{"AIMAX.exe", "AIMAX-EngageWrite.exe", "AIMAX-Find.exe"} {
		candidate := filepath.Join(appDir, name)
		info, err := os.Stat(candidate)
		if err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("AIMAX core executable not found in %s", appDir)
}

func existingCoreFromLock() (bool, int, string) {
	path, err := lockPath()
	if err != nil {
		return false, 0, ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return false, 0, ""
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || pid <= 0 || pid == os.Getpid() {
		return false, 0, ""
	}
	running, exePath := processRunning(pid)
	if !running || !isCoreExeName(filepath.Base(exePath)) {
		return false, pid, exePath
	}
	return true, pid, exePath
}

func processRunning(pid int) (bool, string) {
	const processQueryLimitedInformation = 0x1000
	handle, _, _ := procOpenProcess.Call(processQueryLimitedInformation, 0, uintptr(uint32(pid)))
	if handle == 0 {
		return false, ""
	}
	defer closeHandle(syscall.Handle(handle))

	var exitCode uint32
	ok, _, _ := procGetExitCodeProcess.Call(handle, uintptr(unsafe.Pointer(&exitCode)))
	if ok == 0 || exitCode != stillActive {
		return false, ""
	}

	var size uint32 = 32768
	buffer := make([]uint16, size)
	ok, _, _ = procQueryFullProcessImageName.Call(
		handle,
		0,
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if ok == 0 || size == 0 {
		return true, ""
	}
	return true, syscall.UTF16ToString(buffer[:size])
}

func isCoreExeName(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "aimax.exe", "aimax-engagewrite.exe", "aimax-find.exe":
		return true
	default:
		return false
	}
}

func requestKind(args []string) string {
	joined := strings.ToLower(strings.Join(args, " "))
	switch {
	case strings.Contains(joined, "open_settings"), strings.Contains(joined, "open-settings"), strings.Contains(joined, "settings"):
		return "open_settings"
	case strings.Contains(joined, "status"):
		return "status"
	case strings.Contains(joined, "connect"):
		return "connect"
	default:
		return "connect"
	}
}

func cliFlagForKind(kind string) string {
	switch kind {
	case "open_settings":
		return "--open-settings"
	case "status":
		return "--status"
	default:
		return "--connect"
	}
}

func protocolURL(args []string) string {
	for _, arg := range args {
		if strings.HasPrefix(strings.ToLower(arg), "aimax://") {
			return arg
		}
	}
	return ""
}

func requestPath() (string, error) {
	dir, err := requestDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, requestFileName), nil
}

func lockPath() (string, error) {
	dir, err := requestDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, lockFileName), nil
}

func requestDir() (string, error) {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		configDir, err := os.UserConfigDir()
		if err != nil {
			return "", err
		}
		appData = configDir
	}
	dir := filepath.Join(appData, requestDirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func writeRequest(kind, url string) error {
	path, err := requestPath()
	if err != nil {
		return err
	}
	payload := requestPayload{
		Kind:      kind,
		PID:       os.Getpid(),
		Timestamp: float64(time.Now().UnixNano()) / 1e9,
		Source:    "native-go-launcher",
		URL:       url,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	tmp := fmt.Sprintf("%s.%d.tmp", path, os.Getpid())
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func diagnosticsPath() (string, error) {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		configDir, err := os.UserConfigDir()
		if err != nil {
			return "", err
		}
		appData = configDir
	}
	dir := filepath.Join(appData, diagnosticsDirName, "launcher_diagnostics")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	name := fmt.Sprintf("launcher_%s.jsonl", time.Now().Format("20060102"))
	return filepath.Join(dir, name), nil
}

func writeDiagnostic(stage, kind string, protocolURLPresent bool, coreExeName, message string) {
	path, err := diagnosticsPath()
	if err != nil {
		return
	}
	item := launcherDiagnostic{
		Timestamp:          time.Now().Format(time.RFC3339),
		LauncherVersion:    launcherVersion,
		Stage:              stage,
		Kind:               kind,
		PID:                os.Getpid(),
		ProtocolURLPresent: protocolURLPresent,
		CoreExeName:        coreExeName,
		Message:            compactMessage(message),
	}
	data, err := json.Marshal(item)
	if err != nil {
		return
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.Write(append(data, '\n'))
}

func compactMessage(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 240 {
		return value
	}
	return value[:240]
}

func showMessage(title, body string) {
	titlePtr, titleErr := syscall.UTF16PtrFromString(title)
	bodyPtr, bodyErr := syscall.UTF16PtrFromString(body)
	if titleErr != nil || bodyErr != nil {
		return
	}
	procMessageBox.Call(0, uintptr(unsafe.Pointer(bodyPtr)), uintptr(unsafe.Pointer(titlePtr)), 0)
}

func showAlreadyRunningMessage() {
	showMessage(
		"AIMAX 실행 중",
		"AIMAX 실행기가 이미 실행 중입니다.\n작업 표시줄 또는 숨겨진 아이콘을 확인한 뒤 웹페이지로 돌아가 연결 상태를 확인해주세요.",
	)
}
