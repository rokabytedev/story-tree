right now, when shots production run into gemini issue (e.g. sometimes gemini can get the response json format wrong and retry usually fix it).
the shots production is a long process with many individual independent gemini requests.
make improvements to make the process more reliable:
- add retry for gemini. there is already retry logic when 500 server error from gemini. now expand that retry to include gemini response format error as well. (e.g. the validation failure).
- add support to the workflow level to support resume if an error happens and interrupted the workflow. it should resume with the remaining shots. for shots already in db, don't repeat or override.
- for cli, consolidate the --resume flag for interactive script and shots production. also make sure to add the --resume flag to cli help message.