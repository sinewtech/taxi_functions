# Taxi Functions

Back-end para el sistema completo.

## Motivacion

Para poder hacer codigo repetitivo universal atravez de todo el sistema.

## Estilo de codigo

Estamos usando el estilo de programacion de [Expo](https://github.com/expo) eslint-config-universe para linting y prettier para style.

![Style](https://img.shields.io/badge/Coding_Style-eslint--config--unverse-blue.svg)

### Eslint

```js
Este es .eslintrc.js
module.exports = {
  extends: ["universe/node", "prettier"],
  parserOptions: {
    es6: true,
  },
};
```

### Prettier

```json
Este es .prettierrc
{
  "printWidth": 100,
  "tabWidth": 2,
  "singleQuote": false,
  "jsxBracketSameLine": true,
  "trailingComma": "es5"
}
```

## Commits

Inspirado en [dannyfritz/commit-message-emoji](https://github.com/dannyfritz/commit-message-emoji)

| Commit type              | Emoji                                                     |
| :----------------------- | :-------------------------------------------------------- |
| Initial commit           | :tada: `:tada:`                                           |
| Version tag              | :bookmark: `:bookmark:`                                   |
| New feature              | :sparkles: `:sparkles:`                                   |
| Bugfix                   | :bug: `:bug:`                                             |
| Metadata                 | :card_index: `:card_index:`                               |
| Documenting source code  | :bulb: `:bulb:`                                           |
| Performance              | :racehorse: `:racehorse:`                                 |
| Cosmetic                 | :lipstick: `:lipstick:`                                   |
| General update           | :zap: `:zap:`                                             |
| Improve format/structure | :art: `:art:`                                             |
| Refactor code            | :hammer: `:hammer:`                                       |
| Removing code/files      | :fire: `:fire:`                                           |
| Continuous Integration   | :green_heart: `:green_heart:`                             |
| Security                 | :lock: `:lock:`                                           |
| Upgrading dependencies   | :arrow_up: `:arrow_up:`                                   |
| Downgrading dependencies | :arrow_down: `:arrow_down:`                               |
| Lint                     | :shirt: `:shirt:`                                         |
| Translation              | :alien: `:alien:`                                         |
| Text                     | :pencil: `:pencil:`                                       |
| Critical hotfix          | :ambulance: `:ambulance:`                                 |
| Deploying stuff          | :rocket: `:rocket:`                                       |
| Work in progress         | :construction: `:construction:`                           |
| Adding CI build system   | :construction_worker: `:construction_worker:`             |
| Removing a dependency    | :heavy_minus_sign: `:heavy_minus_sign:`                   |
| Adding a dependency      | :heavy_plus_sign: `:heavy_plus_sign:`                     |
| Package.json in JS       | :package: `:package:`                                     |
| Merging branches         | :twisted_rightwards_arrows: `:twisted_rightwards_arrows:` |
| Bad code / need improv.  | :hankey: `:hankey:`                                       |
| Reverting changes        | :rewind: `:rewind:`                                       |
| Breaking changes         | :boom: `:boom:`                                           |
| Code review changes      | :ok_hand: `:ok_hand:`                                     |
| Accessibility            | :wheelchair: `:wheelchair:`                               |
| Move/rename repository   | :truck: `:truck:`                                         |
| Other                    | [Be creative](http://www.emoji-cheat-sheet.com/)          |


Prueba
