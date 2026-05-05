#!/usr/bin/env sh
set -eu

repo="bumpcore/trackboi"
install_dir="${TRACKBOI_INSTALL_DIR:-$HOME/.local/bin}"
tmp_dir="${TMPDIR:-/tmp}/trackboi-install.$$"

cleanup() {
	rm -rf "$tmp_dir"
}

trap cleanup EXIT
mkdir -p "$tmp_dir"

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

need() {
	if ! command_exists "$1"; then
		echo "trackboi installer requires '$1'." >&2
		exit 1
	fi
}

download() {
	url="$1"
	output="$2"

	if command_exists curl; then
		curl -fL "$url" -o "$output"
	elif command_exists wget; then
		wget -O "$output" "$url"
	else
		echo "trackboi installer requires curl or wget." >&2
		exit 1
	fi
}

latest_url() {
	if command_exists curl; then
		curl -fsSL -o /dev/null -w "%{url_effective}" "https://github.com/$repo/releases/latest"
	elif command_exists wget; then
		wget -qO- --server-response "https://github.com/$repo/releases/latest" 2>&1 \
			| awk '/^  Location: / { url=$2 } END { gsub("\r", "", url); print url }'
	else
		echo "trackboi installer requires curl or wget." >&2
		exit 1
	fi
}

tag="$(basename "$(latest_url)")"
version="${tag#v}"

if [ -z "$version" ] || [ "$version" = "$tag" ]; then
	echo "Could not resolve the latest trackboi release version." >&2
	exit 1
fi

os="$(uname -s)"
arch="$(uname -m)"

case "$os:$arch" in
	Linux:x86_64|Linux:amd64)
		if command_exists dpkg; then
			asset="trackboi-$version-amd64.deb"
			file="$tmp_dir/$asset"
			download "https://github.com/$repo/releases/download/$tag/$asset" "$file"
			if command_exists apt-get; then
				if [ "$(id -u)" -eq 0 ]; then
					apt-get install -y "$file"
				else
					sudo apt-get install -y "$file"
				fi
			else
				if [ "$(id -u)" -eq 0 ]; then
					dpkg -i "$file"
				else
					sudo dpkg -i "$file"
				fi
			fi
		elif command_exists rpm; then
			asset="trackboi-$version-x86_64.rpm"
			file="$tmp_dir/$asset"
			download "https://github.com/$repo/releases/download/$tag/$asset" "$file"
			if command_exists dnf; then
				if [ "$(id -u)" -eq 0 ]; then
					dnf install -y "$file"
				else
					sudo dnf install -y "$file"
				fi
			elif command_exists zypper; then
				if [ "$(id -u)" -eq 0 ]; then
					zypper --non-interactive install "$file"
				else
					sudo zypper --non-interactive install "$file"
				fi
			else
				if [ "$(id -u)" -eq 0 ]; then
					rpm -Uvh "$file"
				else
					sudo rpm -Uvh "$file"
				fi
			fi
		else
			asset="trackboi-$version-x86_64.AppImage"
			file="$install_dir/trackboi"
			mkdir -p "$install_dir"
			download "https://github.com/$repo/releases/download/$tag/$asset" "$file"
			chmod +x "$file"
			echo "Installed trackboi AppImage to $file"
			echo "Make sure $install_dir is on PATH."
		fi
		;;
	Darwin:arm64)
		need ditto
		asset="trackboi-$version-arm64.zip"
		file="$tmp_dir/$asset"
		app_dir="${TRACKBOI_APP_DIR:-/Applications}"
		download "https://github.com/$repo/releases/download/$tag/$asset" "$file"
		ditto -x -k "$file" "$tmp_dir/app"
		if [ -d "$app_dir" ] && [ -w "$app_dir" ]; then
			rm -rf "$app_dir/trackboi.app"
			cp -R "$tmp_dir/app/trackboi.app" "$app_dir/trackboi.app"
		else
			sudo rm -rf "$app_dir/trackboi.app"
			sudo cp -R "$tmp_dir/app/trackboi.app" "$app_dir/trackboi.app"
		fi
		echo "Installed trackboi to $app_dir/trackboi.app"
		;;
	*)
		echo "Unsupported platform: $os $arch" >&2
		echo "Download manually from https://github.com/$repo/releases/latest" >&2
		exit 1
		;;
esac
