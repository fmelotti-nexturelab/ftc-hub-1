@echo off
pyinstaller --onefile --name ftchub-nav-agent --hidden-import win32com --hidden-import win32gui --hidden-import win32process --hidden-import win32con --hidden-import openpyxl nav_agent.py
pause
