# @insectos/ssh-exec

Node that establishs a ssh terminal connection to a remote host. The remote host can be selected from `~/.ssh/config` and supports ssh keys. Wrapper around [ssh2](https://www.npmjs.com/package/ssh2)

## Useage

Select a host from the dropdown or provide manual configuration. Connection to the host will happen on first data received. Connections are reestablished as needed.

Use a Catch node to see what errors are thrown from the SSH node that aren't already being caught and handled.

### Input

`msg.payload <string>` = The command that you wish to be sent to the remote shell
`msg.sshhost <string>` = OPTIONAL overwrite the configured hostname, must exist in `.ssh/config` Once overwritten all following commands go to the new host

### Output

`msg.payload <string>` = The text printed to STDOUT on the remote shell

`msg.host` = The IP address of the connected host. This is also returned on errors so can be used in conjunction with the Catch node so only one Catch node is needed to watch all uses of the Interactive SSH node.

## WIP

- move setup to a config node, so credentials are encrypted
- backfill unit tests

## Credits

Inspired by [node-red-contrib-interactive-ssh](https://www.npmjs.com/package/node-red-contrib-interactive-ssh). Since the connection mechanism was completely redesigned, a new package is warranted
