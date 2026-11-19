#!/usr/bin/env bash
#
# Rilis kode terbaru dari GitHub ke produksi (CloudPanel VPS).
#
#   sudo ./deploy.sh              deploy kalau ada commit baru di origin/main
#   sudo ./deploy.sh --force      jalankan semua langkah walau tidak ada commit baru
#   sudo ./deploy.sh help         perintah lain: status, restart, logs, down, up
#
# git, composer, dan npm jalan sebagai root; artisan jalan sebagai user situs
# supaya cache dan log di storage/ tetap milik user itu.

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${APP_USER:-kisantra-marketing}"
BRANCH="${BRANCH:-main}"
SERVICES=(kisantra-ssr kisantra-queue kisantra-reverb)
LOG_FILE="${LOG_FILE:-/var/log/kisantra-deploy.log}"
LOCK_FILE="${LOCK_FILE:-/var/lock/kisantra-deploy.lock}"

# Jangan biarkan git menunggu input password atau membuka pager.
export GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat

ARGS=''
FORCE=0
VERBOSE=0
LOG_TARGET=all
STEP=0
STEP_TOTAL=0
STEP_OUT=''
SPIN_PID=''
OLD_REV=''
NEW_REV=''

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    TTY=1
    BOLD=$'\e[1m' DIM=$'\e[2m' RED=$'\e[31m' GREEN=$'\e[32m' YELLOW=$'\e[33m' CYAN=$'\e[36m' RESET=$'\e[0m'
    CLR=$'\r\e[K'
else
    TTY=0
    BOLD='' DIM='' RED='' GREEN='' YELLOW='' CYAN='' RESET='' CLR=''
fi

# ─── Tampilan ─────────────────────────────────────────────────────────────────

ok()      { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()    { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
bad()     { printf '  %s✗%s %s\n' "$RED" "$RESET" "$*"; }
bullet()  { printf '  %s•%s %s\n' "$CYAN" "$RESET" "$*"; }
note()    { printf '    %s%s%s\n' "$DIM" "$*" "$RESET"; }
section() { printf '\n%s%s%s\n' "$BOLD" "$*" "$RESET"; }

banner() {
    printf '\n%s%s▲ %s%s\n' "$BOLD" "$CYAN" "$1" "$RESET"
    printf '  %s%s%s\n' "$DIM" "$2" "$RESET"
}

# indent "awalan" < teks — loop bash, bukan sed, supaya karakter seperti │ aman di locale apa pun.
indent() {
    local line
    while IFS= read -r line || [[ -n $line ]]; do
        printf '%s%s\n' "$1" "$line"
    done
}

die() {
    printf '%s\n  %s%s✗ %s%s\n' "$CLR" "$RED" "$BOLD" "$1" "$RESET" >&2
    shift
    if (( $# )); then
        printf '%s\n' "$@" | indent '    ' >&2
    fi
    printf '\n' >&2
    exit 1
}

human_time() {
    local s=$1
    if (( s >= 60 )); then
        printf '%dm %02ds' $((s / 60)) $((s % 60))
    else
        printf '%ds' "$s"
    fi
}

# ─── Menjalankan langkah ──────────────────────────────────────────────────────

# Spinner jalan di background sementara perintahnya di foreground, supaya
# Ctrl+C tetap sampai ke perintah yang sedang berjalan.
spinner() {
    local title=$1 frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏) i=0 start=$SECONDS
    trap 'exit 0' TERM
    while kill -0 $$ 2>/dev/null; do
        printf '%s  %s%s%s %s %s%s%s' "$CLR" "$CYAN" "${frames[i++ % 10]}" "$RESET" \
            "$title" "$DIM" "$(human_time $((SECONDS - start)))" "$RESET"
        sleep 0.1
    done
}

start_spinner() {
    printf '\e[?25l'
    spinner "$1" &
    SPIN_PID=$!
}

stop_spinner() {
    if [[ -n $SPIN_PID ]]; then
        kill "$SPIN_PID" 2>/dev/null || true
        wait "$SPIN_PID" 2>/dev/null || true
        SPIN_PID=''
        printf '\e[?25h'
    fi
}

# run "Judul" perintah [argumen...]
# Output perintah masuk ke log. Kalau gagal, potongan terakhirnya ditampilkan
# beserta $HINT (bisa diberikan sebagai prefix: HINT='...' run ...).
run() {
    local title=$1 start=$SECONDS rc=0
    shift

    local plain=${title//"$DIM"/}
    printf '\n── %s\n$ %s\n' "${plain//"$RESET"/}" "$*" >>"$LOG_FILE"

    if (( VERBOSE )); then
        printf '  %s\n' "$title"
        set +e
        "$@" </dev/null 2>&1 | tee "$STEP_OUT" | indent "    ${DIM}│$RESET "
        rc=${PIPESTATUS[0]}
        set -e
    else
        if (( TTY )); then
            start_spinner "$title"
        else
            printf '  … %s\n' "$title"
        fi
        "$@" </dev/null >"$STEP_OUT" 2>&1 || rc=$?
        stop_spinner
    fi
    cat "$STEP_OUT" >>"$LOG_FILE"

    local took
    took=$(human_time $((SECONDS - start)))
    if (( rc == 0 )); then
        printf '%s  %s✓%s %s %s%s%s\n' "$CLR" "$GREEN" "$RESET" "$title" "$DIM" "$took" "$RESET"
        return 0
    fi

    printf '%s  %s✗%s %s %s%s%s\n' "$CLR" "$RED" "$RESET" "$title" "$DIM" "$took" "$RESET"
    printf '\n  %s%sGagal: %s%s %s(exit %d)%s\n' "$RED" "$BOLD" "$title" "$RESET" "$DIM" "$rc" "$RESET"
    if (( ! VERBOSE )) && [[ -s $STEP_OUT ]]; then
        printf '\n    %sOutput terakhir:%s\n' "$DIM" "$RESET"
        tail -n 25 "$STEP_OUT" | indent "    ${DIM}│$RESET "
    fi
    if [[ -n ${HINT:-} ]]; then
        printf '\n'
        printf '%s\n' "$HINT" | indent "    ${YELLOW}→$RESET "
    fi
    printf '\n    Log lengkap: %s\n\n' "$LOG_FILE"
    exit "$rc"
}

step() {
    STEP=$((STEP + 1))
    local title
    title=$(printf '%s[%d/%d]%s %s' "$DIM" "$STEP" "$STEP_TOTAL" "$RESET" "$1")
    shift
    run "$title" "$@"
}

skip() {
    STEP=$((STEP + 1))
    printf '  %s– [%d/%d]%s %s %sdilewati: %s%s\n' "$DIM" "$STEP" "$STEP_TOTAL" "$RESET" "$1" "$DIM" "$2" "$RESET"
    printf '\n── [%d/%d] %s — dilewati: %s\n' "$STEP" "$STEP_TOTAL" "$1" "$2" >>"$LOG_FILE"
}

# ─── Utilitas ─────────────────────────────────────────────────────────────────

artisan() { sudo -u "$APP_USER" php artisan "$@"; }

composer_install() {
    COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction --no-progress
}

fix_permissions() {
    if [[ ! -e public/storage && ! -L public/storage ]]; then
        php artisan storage:link || return
    fi
    chown -R "$APP_USER:$APP_USER" storage bootstrap/cache
}

app_url() {
    local url
    url=$(sed -n 's/^APP_URL=//p' "$APP_DIR/.env" 2>/dev/null | tail -n 1 | tr -d "\"' \r")
    printf '%s' "${url%/}"
}

app_host() {
    local host
    host=$(app_url)
    host=${host#*://}
    host=${host%%/*}
    printf '%s' "${host:-$(basename "$APP_DIR")}"
}

short_rev() { git rev-parse --short "$1"; }

# Apakah file tertentu berubah antara versi lama dan baru?
changed() { ! git diff --quiet "$OLD_REV" "$NEW_REV" -- "$@"; }

require_root() {
    if (( EUID != 0 )); then
        die "Perintah ini perlu dijalankan sebagai root." "Coba: sudo $0 $ARGS"
    fi
}

require_git_repo() {
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        die "git tidak bisa membaca repo di $APP_DIR" \
            "Kalau karena 'dubious ownership': git config --global --add safe.directory $APP_DIR"
    fi
}

require_commands() {
    local missing=() cmd
    for cmd in "$@"; do
        command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
    done
    if (( ${#missing[@]} )); then
        die "Perintah tidak ditemukan: ${missing[*]}" "Pastikan sudah terpasang dan ada di PATH root."
    fi
}

enter_app_dir() {
    cd "$APP_DIR"
    [[ -f artisan ]] || die "Ini bukan folder Laravel: $APP_DIR" "deploy.sh harus berada di root project."
    [[ -f .env ]] || die "File .env tidak ada di $APP_DIR"
    id "$APP_USER" >/dev/null 2>&1 || die "User '$APP_USER' tidak ada di server ini." "Set dengan: APP_USER=nama-user sudo ./deploy.sh"
}

acquire_lock() {
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        die "Ada deploy lain yang sedang berjalan." "Tunggu sampai selesai, lalu coba lagi."
    fi
}

start_log() {
    touch "$LOG_FILE" 2>/dev/null || die "Tidak bisa menulis log ke $LOG_FILE"
    if [[ -n $(find "$LOG_FILE" -size +5M 2>/dev/null) ]]; then
        mv -f "$LOG_FILE" "$LOG_FILE.1"
    fi
    STEP_OUT=$(mktemp)
    printf '\n===== %s · %s · oleh %s =====\n' "$(date '+%F %T')" "$1" "${SUDO_USER:-$(whoami)}" >>"$LOG_FILE"
}

cleanup() {
    stop_spinner
    if [[ -n $STEP_OUT ]]; then
        rm -f "$STEP_OUT"
    fi
}

on_interrupt() {
    stop_spinner
    die "Dibatalkan." "Kalau berhenti di tengah deploy, jalankan ulang: sudo ./deploy.sh --force"
}

# Return jumlah masalah yang ditemukan (0 = sehat).
check_health() {
    local problems=0 svc state url code attempt

    section "Pemeriksaan"
    run "Menunggu service stabil" sleep 3

    for svc in "${SERVICES[@]}"; do
        state=$(systemctl is-active "$svc" 2>/dev/null || true)
        if [[ $state == active ]]; then
            ok "$svc aktif"
        else
            bad "$svc ${state:-tidak dikenal}"
            note "Lihat penyebabnya: journalctl -u $svc -n 50 --no-pager"
            problems=$((problems + 1))
        fi
    done

    if [[ -f storage/framework/down ]]; then
        warn "Mode maintenance sedang AKTIF — matikan dengan: sudo ./deploy.sh up"
    fi

    url="$(app_url)/up"
    if [[ $url == /up ]]; then
        warn "APP_URL kosong di .env, cek HTTP dilewati"
    elif ! command -v curl >/dev/null 2>&1; then
        warn "curl tidak terpasang, cek HTTP dilewati"
    else
        for attempt in 1 2 3; do
            code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || true)
            [[ $code == 200 ]] && break
            sleep 2
        done
        if [[ $code == 200 ]]; then
            ok "$url → 200 OK"
        else
            bad "$url → ${code:-000}"
            note "Lihat error aplikasi: sudo ./deploy.sh logs app"
            problems=$((problems + 1))
        fi
    fi

    return "$problems"
}

# ─── Perintah ─────────────────────────────────────────────────────────────────

cmd_deploy() {
    local started=$SECONDS behind ahead dirty run_npm=0 npm_reason='' new_migrations

    require_root
    require_commands git php composer npm systemctl flock sudo
    enter_app_dir
    require_git_repo
    acquire_lock
    start_log deploy

    banner "Deploy ke produksi" "$(app_host) · branch $BRANCH · $(date '+%d/%m/%Y %H:%M')"

    section "Persiapan"
    ok "Folder aplikasi: $APP_DIR"

    local current
    current=$(git rev-parse --abbrev-ref HEAD)
    if [[ $current != "$BRANCH" ]]; then
        die "Server sedang di branch '$current', bukan '$BRANCH'." "Pindah dulu: git checkout $BRANCH"
    fi

    dirty=$(git status --porcelain --untracked-files=no)
    if [[ -n $dirty ]]; then
        die "Ada file yang diubah langsung di server dan belum di-commit:" \
            "$dirty" \
            "" \
            "git pull akan bentrok dengan perubahan ini. Pilih salah satu:" \
            "  • buang perubahannya : git checkout -- <file>" \
            "  • lihat isinya dulu  : git diff"
    fi
    ok "Tidak ada perubahan lokal di server"

    HINT="Kalau 'Permission denied (publickey)': deploy key GitHub untuk root belum terpasang." \
        run "Ambil info terbaru dari GitHub" git fetch --prune origin "$BRANCH"

    OLD_REV=$(git rev-parse HEAD)
    NEW_REV=$(git rev-parse "origin/$BRANCH")
    behind=$(git rev-list --count "HEAD..origin/$BRANCH")
    ahead=$(git rev-list --count "origin/$BRANCH..HEAD")

    if (( ahead > 0 )); then
        die "Server punya $ahead commit yang tidak ada di origin/$BRANCH." \
            "Commit sebaiknya tidak dibuat langsung di server. Lihat: git log origin/$BRANCH..HEAD"
    fi

    if (( behind == 0 )); then
        if (( ! FORCE )); then
            ok "Sudah versi terbaru: $(git log -1 --format='%h %s')"
            note "Tidak ada yang perlu dideploy. Pakai --force untuk tetap build ulang."
            printf '\n'
            return 0
        fi
        warn "Tidak ada commit baru — tetap build ulang karena --force"
    fi

    if (( FORCE )); then
        run_npm=1
    elif [[ ! -d node_modules ]]; then
        run_npm=1
    elif changed package.json package-lock.json; then
        run_npm=1
    else
        npm_reason='package-lock.json tidak berubah'
    fi

    if (( behind > 0 )); then
        section "Yang akan dideploy ${DIM}($(short_rev "$OLD_REV") → $(short_rev "$NEW_REV"), $behind commit)${RESET}"
        git log -n 15 --date=format:'%d/%m %H:%M' \
            --format="  ${YELLOW}%h${RESET} %s ${DIM}· %an, %ad${RESET}" "HEAD..origin/$BRANCH"
        if (( behind > 15 )); then
            note "… dan $((behind - 15)) commit lainnya"
        fi

        new_migrations=$(git diff --name-only --diff-filter=A "$OLD_REV" "$NEW_REV" -- database/migrations | wc -l | tr -d ' ')
        printf '\n'
        if changed composer.lock; then
            bullet "composer.lock berubah — dependency PHP ikut diperbarui"
        fi
        if (( run_npm )) && changed package.json package-lock.json; then
            bullet "package-lock.json berubah — npm ci dijalankan"
        fi
        if (( new_migrations > 0 )); then
            bullet "$new_migrations migrasi database baru"
        fi
        if changed .env.example; then
            bullet "${YELLOW}.env.example berubah — cek apakah .env produksi perlu variabel baru${RESET}"
        fi
    fi

    section "Langkah deploy"
    STEP_TOTAL=9

    # Merge ke commit yang sudah di-fetch, supaya yang dirilis persis yang ditampilkan di atas.
    HINT="Biasanya karena riwayat git di server berbeda dengan GitHub. Cek: git status" \
        step "Tarik kode terbaru ($(short_rev "$OLD_REV") → $(short_rev "$NEW_REV"))" git merge --ff-only "$NEW_REV"

    HINT="Cek versi PHP (php -v) dan koneksi ke packagist.org." \
        step "Install dependency PHP (composer install)" composer_install

    if (( run_npm )); then
        HINT="Cek versi Node (node -v) dan koneksi ke registry npm." \
            step "Install dependency JS (npm ci)" npm ci --no-audit --no-fund
    else
        skip "Install dependency JS (npm ci)" "$npm_reason"
    fi

    # Harus sebelum build: plugin Vite menjalankan wayfinder:generate yang
    # membaca route cache. Cache lama = route baru tidak ikut ter-generate.
    step "Bersihkan cache Laravel (optimize:clear)" artisan optimize:clear

    HINT="Kalau error soal export yang tidak ada di resources/js/routes, route cache lama masih terbaca.
Folder public/build sudah dikosongkan Vite, jadi situs tampil tanpa CSS/JS sampai build berhasil.
Perbaiki errornya lalu jalankan ulang: sudo ./deploy.sh --force" \
        step "Build aset frontend + SSR (npm run build:ssr)" npm run build:ssr

    HINT="Cek koneksi database di .env. Migrasi yang sudah sukses tidak di-rollback otomatis." \
        step "Migrasi database (migrate --force)" artisan migrate --force

    HINT="Biasanya ada error di file config/ atau routes/. Situs tetap jalan, hanya tanpa cache." \
        step "Cache ulang config, route, view (optimize)" artisan optimize

    step "Rapikan izin storage/ dan bootstrap/cache/" fix_permissions

    HINT="Lihat penyebabnya: journalctl -u <nama-service> -n 50 --no-pager" \
        step "Restart service (${SERVICES[*]})" systemctl restart "${SERVICES[@]}"

    local healthy=1
    check_health || healthy=0

    local took
    took=$(human_time $((SECONDS - started)))
    printf '\n'
    if (( healthy )); then
        printf '%s%s✓ Deploy selesai dalam %s%s\n' "$GREEN" "$BOLD" "$took" "$RESET"
    else
        printf '%s%s! Deploy selesai dalam %s, tapi ada pemeriksaan yang gagal (lihat di atas)%s\n' "$YELLOW" "$BOLD" "$took" "$RESET"
    fi
    note "Versi: $(short_rev "$OLD_REV") → $(git log -1 --format='%h %s')"
    note "Log  : $LOG_FILE"
    if changed deploy.sh; then
        note "deploy.sh ikut diperbarui — versi barunya dipakai mulai deploy berikutnya."
    fi
    printf '\n'

    # Baris penanda ini dibaca 'deploy.sh status' untuk "Deploy terakhir".
    printf '>>> %s · %s → %s · oleh %s\n' "$(date '+%d/%m/%Y %H:%M')" \
        "$(short_rev "$OLD_REV")" "$(short_rev "$NEW_REV")" "${SUDO_USER:-$(whoami)}" >>"$LOG_FILE"

    (( healthy ))
}

cmd_status() {
    local svc state since behind last_deploy

    require_root
    enter_app_dir
    require_git_repo

    banner "Status produksi" "$(app_host) · $(date '+%d/%m/%Y %H:%M')"

    section "Kode"
    ok "Branch $(git rev-parse --abbrev-ref HEAD) · $(git log -1 --date=format:'%d/%m/%Y %H:%M' --format='%h %s (%ad)')"
    if git fetch -q origin "$BRANCH" 2>/dev/null; then
        behind=$(git rev-list --count "HEAD..origin/$BRANCH")
        if (( behind > 0 )); then
            warn "Tertinggal $behind commit dari origin/$BRANCH — jalankan: sudo ./deploy.sh"
        else
            ok "Sama dengan origin/$BRANCH"
        fi
    else
        warn "Gagal menghubungi GitHub, tidak bisa membandingkan dengan origin/$BRANCH"
    fi
    if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
        warn "Ada file yang diubah langsung di server (lihat: git status)"
    fi
    last_deploy=$(cat "$LOG_FILE.1" "$LOG_FILE" 2>/dev/null | sed -n 's/^>>> //p' | tail -n 1 || true)
    if [[ -n $last_deploy ]]; then
        ok "Deploy terakhir: $last_deploy"
    fi

    section "Service"
    for svc in "${SERVICES[@]}"; do
        state=$(systemctl is-active "$svc" 2>/dev/null || true)
        since=$(systemctl show -p ActiveEnterTimestamp --value "$svc" 2>/dev/null || true)
        if [[ $state == active ]]; then
            ok "$svc aktif ${DIM}sejak $since${RESET}"
        else
            bad "$svc ${state:-tidak dikenal}"
            note "Lihat penyebabnya: journalctl -u $svc -n 50 --no-pager"
        fi
    done

    section "Situs"
    if [[ -f storage/framework/down ]]; then
        warn "Mode maintenance AKTIF — matikan dengan: sudo ./deploy.sh up"
    else
        ok "Mode maintenance tidak aktif"
    fi
    local url code
    url="$(app_url)/up"
    if [[ $url != /up ]] && command -v curl >/dev/null 2>&1; then
        code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || true)
        if [[ $code == 200 ]]; then
            ok "$url → 200 OK"
        else
            bad "$url → ${code:-000}"
        fi
    fi
    printf '\n'
}

cmd_restart() {
    require_root
    require_commands php systemctl flock sudo
    enter_app_dir
    acquire_lock
    start_log restart

    banner "Restart service" "$(app_host) · $(date '+%d/%m/%Y %H:%M')"

    section "Langkah"
    STEP_TOTAL=3
    HINT="Biasanya ada error di file config/ atau routes/, atau nilai .env tidak valid." \
        step "Cache ulang config, route, view (optimize)" artisan optimize
    step "Rapikan izin storage/ dan bootstrap/cache/" fix_permissions
    HINT="Lihat penyebabnya: journalctl -u <nama-service> -n 50 --no-pager" \
        step "Restart service (${SERVICES[*]})" systemctl restart "${SERVICES[@]}"

    local healthy=1
    check_health || healthy=0
    printf '\n'
    (( healthy ))
}

cmd_logs() {
    local args=() svc file
    case $LOG_TARGET in
        all)
            for svc in "${SERVICES[@]}"; do args+=(-u "$svc"); done
            exec journalctl "${args[@]}" -n 100 -f
            ;;
        ssr|queue|reverb)
            exec journalctl -u "kisantra-$LOG_TARGET" -n 100 -f
            ;;
        app)
            file=$(ls -t "$APP_DIR"/storage/logs/laravel*.log 2>/dev/null | head -n 1 || true)
            [[ -n $file ]] || die "Belum ada file log di storage/logs/"
            exec tail -n 100 -f "$file"
            ;;
        deploy)
            [[ -f $LOG_FILE ]] || die "Belum ada log deploy di $LOG_FILE"
            exec less -R +G "$LOG_FILE"
            ;;
        *)
            die "Log '$LOG_TARGET' tidak dikenal." "Pilihan: ssr, queue, reverb, app, deploy (tanpa argumen = semua service)"
            ;;
    esac
}

cmd_down() {
    require_root
    enter_app_dir
    start_log down
    banner "Mode maintenance" "$(app_host)"
    printf '\n'
    run "Nyalakan mode maintenance" artisan down --retry=60
    note "Pengunjung sekarang melihat halaman 503. Matikan dengan: sudo ./deploy.sh up"
    printf '\n'
}

cmd_up() {
    require_root
    enter_app_dir
    start_log up
    banner "Mode maintenance" "$(app_host)"
    printf '\n'
    run "Matikan mode maintenance" artisan up
    note "Situs kembali bisa diakses."
    printf '\n'
}

cmd_help() {
    cat <<EOF

${BOLD}Pemakaian:${RESET} sudo ./deploy.sh [perintah] [opsi]

${BOLD}Perintah${RESET}
  deploy          Tarik kode terbaru dari GitHub dan rilis ke produksi ${DIM}(default)${RESET}
  status          Versi yang sedang jalan, status service, dan cek situs
  restart         Cache ulang config lalu restart service ${DIM}— pakai setelah mengubah .env${RESET}
  logs [nama]     Ikuti log secara live: ssr, queue, reverb, app, deploy
                  ${DIM}tanpa nama = gabungan semua service; keluar dengan Ctrl+C${RESET}
  down            Nyalakan mode maintenance (pengunjung melihat halaman 503)
  up              Matikan mode maintenance
  help            Tampilkan bantuan ini

${BOLD}Opsi deploy${RESET}
  -f, --force     Jalankan semua langkah walau tidak ada commit baru (termasuk npm ci)
  -v, --verbose   Tampilkan output lengkap tiap langkah

${BOLD}Contoh${RESET}
  sudo ./deploy.sh
  sudo ./deploy.sh --force --verbose
  sudo ./deploy.sh logs queue

Log tiap deploy disimpan di ${LOG_FILE}

EOF
}

main() {
    local cmd=deploy
    ARGS="$*"

    while (( $# )); do
        case $1 in
            deploy|status|restart|down|up|help) cmd=$1 ;;
            logs)
                cmd=logs
                if [[ -n ${2:-} && $2 != -* ]]; then
                    LOG_TARGET=$2
                    shift
                fi
                ;;
            -f|--force) FORCE=1 ;;
            -v|--verbose) VERBOSE=1 ;;
            -h|--help) cmd=help ;;
            *) die "Perintah atau opsi tidak dikenal: $1" "Lihat daftar perintah: ./deploy.sh help" ;;
        esac
        shift
    done

    trap cleanup EXIT
    trap on_interrupt INT TERM

    "cmd_$cmd"
}

# Satu baris: bash sudah membaca 'exit' sebelum git sempat mengganti file ini,
# jadi deploy yang sedang jalan tidak ikut membaca versi barunya.
main "$@"; exit
