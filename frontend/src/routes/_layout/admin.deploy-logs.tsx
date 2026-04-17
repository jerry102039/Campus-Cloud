import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ScriptDeployLogsAPI,
  type ScriptDeployLogQuery,
} from "@/services/scriptDeployLogs"

export const Route = createFileRoute("/_layout/admin/deploy-logs")({
  component: AdminDeployLogsPage,
})

const LIMIT = 50

const STATUS_BADGE: Record<string, string> = {
  running: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-rose-500",
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function AdminDeployLogsPage() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<string>("all")
  const [templateSlug, setTemplateSlug] = useState("")
  const [vmidStr, setVmidStr] = useState("")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const query: ScriptDeployLogQuery = useMemo(
    () => ({
      limit: LIMIT,
      offset: page * LIMIT,
      status: status === "all" ? null : status,
      template_slug: templateSlug.trim() || null,
      vmid: vmidStr.trim() ? Number(vmidStr.trim()) : null,
    }),
    [page, status, templateSlug, vmidStr],
  )

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-deploy-logs", query],
    queryFn: async () => await ScriptDeployLogsAPI.list(query),
    refetchInterval: 5000,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-deploy-logs-detail", selectedTaskId],
    queryFn: async () =>
      selectedTaskId ? await ScriptDeployLogsAPI.detail(selectedTaskId) : null,
    enabled: !!selectedTaskId,
    refetchInterval: (q) => {
      const d = q.state.data
      return d && d.status === "running" ? 2000 : false
    },
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="container mx-auto space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>服務模板部署日誌</CardTitle>
          <CardDescription>
            查看每一次 community-scripts 部署的狀態與完整腳本輸出（每 5 秒自動刷新）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">狀態</label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0) }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">模板 slug</label>
              <Input
                value={templateSlug}
                onChange={(e) => { setTemplateSlug(e.target.value); setPage(0) }}
                placeholder="docker"
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">VMID</label>
              <Input
                value={vmidStr}
                onChange={(e) => { setVmidStr(e.target.value); setPage(0) }}
                placeholder="100"
                className="w-28"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? "刷新中…" : "手動刷新"}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>時間</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>模板</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>VMID</TableHead>
                  <TableHead>進度 / 訊息</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      載入中…
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      尚無部署記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {fmtDate(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[row.status] ?? "bg-gray-500"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.template_name || row.template_slug}
                      </TableCell>
                      <TableCell className="text-sm">{row.hostname ?? "-"}</TableCell>
                      <TableCell className="text-sm">{row.vmid ?? "-"}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {row.status === "failed"
                          ? (row.message ?? "失敗")
                          : (row.progress ?? "-")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTaskId(row.task_id)}
                        >
                          查看 Log
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              共 {total} 筆 · 第 {page + 1} / {totalPages} 頁
            </div>
            <div className="space-x-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                上一頁
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一頁
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedTaskId}
        onOpenChange={(o) => !o && setSelectedTaskId(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              部署 Log
              {detail && (
                <Badge
                  className={`ml-2 ${STATUS_BADGE[detail.status] ?? "bg-gray-500"}`}
                >
                  {detail.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.template_name || detail.template_slug} · ${detail.hostname ?? "-"} · VMID ${detail.vmid ?? "-"}`
                : "載入中…"}
            </DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="py-8 text-center text-muted-foreground">載入中…</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Task ID：</span>{detail.task_id}</div>
                <div><span className="text-muted-foreground">Script：</span>{detail.script_path ?? "-"}</div>
                <div><span className="text-muted-foreground">建立：</span>{fmtDate(detail.created_at)}</div>
                <div><span className="text-muted-foreground">完成：</span>{fmtDate(detail.completed_at)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">進度：</span>{detail.progress ?? "-"}</div>
                {detail.message && (
                  <div className="col-span-2"><span className="text-muted-foreground">訊息：</span>{detail.message}</div>
                )}
              </div>
              {detail.error && (
                <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3">
                  <div className="text-xs font-medium text-rose-600 mb-1">錯誤</div>
                  <pre className="whitespace-pre-wrap text-xs font-mono">{detail.error}</pre>
                </div>
              )}
              <div>
                <div className="text-xs font-medium mb-1">輸出 (stdout)</div>
                <pre className="max-h-[50vh] overflow-auto rounded border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap">
                  {detail.output || "(無輸出)"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
