Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\arham\programs\TREK\scripts\keep_upnp_forward.ps1""", 0, False
