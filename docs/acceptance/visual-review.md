# 暖白松绿界面复核

完整对照报告见项目根 [design-qa.md](../../design-qa.md)。参考原图与PRD未修改。

| 状态 | 1487×1058 | 1100×800 |
| --- | --- | --- |
| 空档案 | [截图](screenshots/home-1487.png) | [截图](screenshots/home-1100.png) |
| 合成填充档案 | [截图](screenshots/home-filled-1487.png) | [截图](screenshots/home-filled-1100.png) |
| 完整滚动内容 | [长页](screenshots/home-filled-1487-full.png) | [长页](screenshots/home-filled-1100-full.png) |

[小窗详情](screenshots/record-detail-1100.png)、[小窗连接设置](screenshots/settings-1100.png) 已查看。原图、实际图均按原尺寸检查，未把示例当用户真实档案。

初轮复核发现填充预览挤下最近归档及底部同步状态，新增视口回归先失败。修复间距、输入初始高度、标题层级和底部常驻状态后，重新截图并通过空／填充测试。两种尺寸均保留归档、同步操作和三端状态；1487首屏显示两条最近归档，小窗右侧摘要纵向下移。

结果：视觉验收通过。原生系统字体、控件及库图标与生成图不要求逐像素相同。真实云端配置仍待验，与视觉通过是不同事项。
