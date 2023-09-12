# @insectos/ssh-exec

Node that establishs a ssh terminal connection to a remote host. The remote host can be selected from `~/.ssh/config` and supports ssh keys. Wrapper around [ssh2](https://www.npmjs.com/package/ssh2)

## Usage

Select a host from the dropdown or provide manual configuration. Connection to the host will happen on first data received. Connections are reestablished as needed.

Use a Catch node to see what errors are thrown from the SSH node that aren't already being caught and handled.

### Input

`msg.payload <string>` = The command that you wish to be sent to the remote shell
`msg.sshhost <string>` = OPTIONAL overwrite the configured hostname, must exist in `.ssh/config` Once overwritten all following commands go to the new host

### Output

`msg.payload <string>` = The text printed to STDOUT on the remote shell

`msg.host` = The IP address of the connected host. This is also returned on errors so can be used in conjunction with the Catch node so only one Catch node is needed to watch all uses of the Interactive SSH node.

## WIP

- backfill unit tests

## Credits

Inspired by [node-red-contrib-interactive-ssh](https://www.npmjs.com/package/node-red-contrib-interactive-ssh). Since the connection mechanism was completely redesigned, a new package is warranted

## Change log

### v0.3.2

- added `sshpassword` to the `msg` object to be able to pass in a sshkey passphrase
- upgraded `ssh-config` to 4.4.0
- fixed issue where password was ignored when selecting host that doesn't have a key file

### v0.3.1

- added a check for the .ssh/config file

### v0.3.0

- Reorganised source to be more testable
- moved password to (encrypted) credentials
- node name shows host from `.ssh/config`
- fixed handover of ssh passphrase
- added example flow
