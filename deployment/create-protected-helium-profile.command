#!/bin/zsh

set -euo pipefail

script_directory="${0:A:h}"
source_profile="$script_directory/helium-policy.mobileconfig"
temporary_profile="/tmp/helium-focus-extension-$(uuidgen).mobileconfig"

cleanup() {
	trap - EXIT HUP INT TERM
	if [[ -f "$temporary_profile" ]]; then
		/bin/unlink "$temporary_profile"
	fi
}

trap cleanup EXIT HUP INT TERM

if [[ ! -f "$source_profile" ]]; then
	print -u2 "Could not find $source_profile"
	exit 1
fi

print "Create a removal password for the Helium Focus Extension profile."
read -r -s "removal_password?Removal password: "
print
read -r -s "confirmed_password?Confirm removal password: "
print

if [[ -z "$removal_password" ]]; then
	print -u2 "The removal password cannot be empty."
	exit 1
fi

if [[ "$removal_password" != "$confirmed_password" ]]; then
	print -u2 "The passwords do not match."
	exit 1
fi

exec 3<<<"$removal_password"
unset removal_password confirmed_password

/usr/bin/python3 - "$source_profile" "$temporary_profile" 3<&3 <<'PYTHON'
import plistlib
import sys
import uuid
from pathlib import Path

source_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
removal_password = open(3, encoding="utf-8").read().rstrip("\n")

with source_path.open("rb") as source_file:
    profile = plistlib.load(source_file)

profile["PayloadRemovalDisallowed"] = True
profile["HasRemovalPasscode"] = True
profile["PayloadContent"].append(
    {
        "PayloadType": "com.apple.profileRemovalPassword",
        "PayloadIdentifier": f'{profile["PayloadIdentifier"]}.removal-password',
        "PayloadUUID": str(uuid.uuid4()).upper(),
        "PayloadVersion": 1,
        "PayloadDisplayName": "Profile removal password",
        "RemovalPassword": removal_password,
    }
)

with output_path.open("wb") as output_file:
    plistlib.dump(profile, output_file, fmt=plistlib.FMT_XML, sort_keys=False)
PYTHON

exec 3<&-

print
print "The protected profile is ready. System Settings will open now."
print "Install Helium Focus Extension, then return here and press Return."
open "$temporary_profile"
read -r "?Press Return after the profile has been installed: "

cleanup
print "The temporary profile has been deleted."
