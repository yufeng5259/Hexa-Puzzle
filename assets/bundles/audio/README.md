# 音频资源（audio 包）

把音频文件放进本目录（可建子目录，如 `bgm/`、`sfx/`），然后在 `assets/bundles/common/config/audio.json` 里填写路径：

- 路径相对本目录，**不带扩展名**，例如文件 `bgm/map.mp3` 填 `"bgm/map"`。
- 路径为空字符串表示该声音还没有制作，播放时静音。
- `bgm`：页面背景音乐，`map` 地图、`puzzle` 拼图、`garden` 家园、`endless` 无尽。
- `sfx`：音效，`click` 按钮、`place` 落子、`invalid` 放不下、`clear` 消除、`combo` 连击、`win` 过关、`fail` 限步失败、`star` 星星、`upgrade` 建筑升级、`claim` 领取奖励、`coin` 花蜜到账、`popup` 弹窗打开、`unlock` 解锁。

放入文件后用 Creator 打开一次工程让它导入（或直接构建），无需改代码。
