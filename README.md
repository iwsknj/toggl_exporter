# toggl_exporter

https://github.com/mkawaguchi/toggl_exporter
↑ここからForkしたもの

## forkしてからの変更点

- togglのAPIのバージョンをv9に変更
- データ取得を2日前からに変更
- 繰り返し実行のときに、カレンダーに作成したイベントをチェック
  - イベントがあれば更新
  - イベントがなければ作成

## 使い方

- このスクリプトを google app scriptのファイルを作成して貼り付ける
- constの定数をよしなに変更する
- watch()を実行
