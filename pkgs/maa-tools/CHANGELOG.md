- 1.2.1

Fix test worker not inheriting parent environment variables

- 1.2.0

Collect test cases from files and match results by file and original case index
Return per-case results grouped by file and platform
Add --list, --json and --jsonl outputs with per-case progress
Validate test.job before loading cases or starting workers

- 1.1.3

Support MaaFramework 5.13.0

- 1.1.2

Fix file watching on macOS

- 1.1.1

Fix default test workers lower than 1 on machines with few CPUs

- 1.1.0

Deduplicate and parallelize resource checks
Group tests by resource paths and reuse worker pools

- 1.0.25

Write MaaFramework logs into debug directories instead of cwd
Support MaaFramework 5.12.2

- 1.0.24

Fix check fail only on error diagnostics instead of any diagnostics

- 1.0.23

Fix attach prop not being merged
Fix incorrect config template
Fix watchers leak

- 1.0.22

Allow more precise parsing

- 1.0.21

Add context to prop selector

- 1.0.20

Change cache folder to ~/.maa-tools
Export @nekosu/maa-pipeline-manager as ./pm
Support parser for custom reco & act

- 1.0.19

Fix check return code error
Support interface group

- 1.0.18

Force require details
Force require .png for image
Move interfacePath to base config
Add vscode config

- 1.0.17

Add extra folder under maa log dir for test
Change hash key
Add pid for reco result

- 1.0.16

Add maaLogDir

- 1.0.15

Add test.errorDetailsPath
Supports dump error details
