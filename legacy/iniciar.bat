@echo off
cd /d "%~dp0"
where python >nul 2>nul || (echo Python nao encontrado. Instale em https://www.python.org/downloads/ & pause & exit /b 1)
python serve.py %*
