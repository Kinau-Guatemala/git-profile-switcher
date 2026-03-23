/**
 * Known git hosting platform domains used for SSH config detection.
 * Any SSH Host entry whose HostName matches one of these is treated
 * as a git-hosting profile that can be imported/detected.
 */
export const GIT_HOSTING_DOMAINS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'codeberg.org',
  'ssh.dev.azure.com',
  'vs-ssh.visualstudio.com',
  'gitea.com',
  'sourcehut.org',
  'sr.ht',
])
