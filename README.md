# 档案智能问答前端

这个前端是 `workstation_143` 的本地档案问答入口。

工作流程：

1. 用户直接输入问题。
2. 本地后端先调用 archive 档案检索。
3. 后端把检索到的资料交给内网问答模型。
4. 页面返回一段中文答案，并显示简短资料来源。

## 本地启动

```powershell
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:3000
```

## 配置

默认会读取：

```text
workstation_143/knowledge_base/知识库交付包_20260403/config.yaml
```

也可以用 `.env.local` 覆盖：

```powershell
ARCHIVE_UI_LLM_URL=
ARCHIVE_UI_LLM_KEY=
ARCHIVE_UI_LLM_MODEL=
ARCHIVE_UI_MODEL_NAME=内网问答模型
KB_API_URL=http://127.0.0.1:8001
```

如果要限定档案根目录：

```powershell
WORKSTATION143_ARCHIVE_ROOTS=D:\AI专班;C:\path\to\archive
```
