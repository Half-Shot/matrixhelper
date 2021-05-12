# matrixhelper

This repo contains a collection of useful scripts to run when you are administering servers or
bridges and need to do repetitive tasks.

Installing is a case of

```sh
yarn
# or
npm i
```

Running them is fairly trivial:

```
export MX_HOMESERVER="https://matrix.org"
export MX_ACCESS_TOKEN="secret"
export MX_APPSERVICE_TOKEN="secret" # OR

export MX_ROOM_ID="!room:domain" # If targetting a room
export MX_ROOM_VIA="matrix.org"

USER_TO_POWER="@Half-Shot:half-shot.uk" USER_POWER=100 yarn run op-user
#or
USER_TO_POWER="@Half-Shot:half-shot.uk" USER_POWER=100 npm run run op-user
```

## Help

This repo is mostly worked on as part of my role as Bridge lead at [element.io](https://element.io).
Feel free to sling me a [DM on Matrix](matrix:u/Half-Shot:half-shot.uk?action=chat) if you need help.