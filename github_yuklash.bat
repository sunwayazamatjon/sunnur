@echo off
echo ========================================
echo   SANNUR OMS - GitHub'ga yuklash boshlandi
echo ========================================

cd /d "%~dp0"

:: 1. Git-ni inisializatsiya qilish
git init

:: 2. Remote-ni sozlash
git remote remove origin >nul 2>&1
git remote add origin https://github.com/sunwayazamatjon/sunnur.git

:: 3. Fayllarni qo'shish
git add .

:: 4. Commit qilish
git commit -m "Update: Added Kirim prices, payment types, and Obyektlar management system"

:: 5. GitHub'ga push qilish (Force push orqali eski noto'g'ri strukturani o'chiramiz)
echo GitHub'ga yuborilmoqda...
git branch -M main
git push -u origin main --force

echo ========================================
echo   TAYYOR! GitHub'ga muvaffaqiyatli yuklandi.
echo ========================================
pause
