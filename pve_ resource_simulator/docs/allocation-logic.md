# PVE Resource Simulator Allocation Logic

## 目的

這份文件用白話方式說明目前第一頁 simulator 的放置邏輯，並整理「尖峰判斷」下一步適合怎麼做。

目前這版的重點不是自動調整 VM 配額，而是：

- 用真實 PVE 當前狀態做放置模擬
- 用同類型 VM 的歷史資料估算有效用量
- 沒歷史時回到保守值
- 盡量把 VM 放到放入後最不擠的 node

## 現在資料從哪裡來

第一頁優先讀取真實 PVE：

- Node 目前 CPU / RAM / Disk 使用量
- Node 是否 online
- 同類型 VM 的歷史平均

目前歷史資料來源是 monthly analytics 的同類型分組，例如：

- `2 vCPU / 2 GiB`
- `2 vCPU / 4 GiB`
- `4 vCPU / 2 GiB`

如果該類型有歷史資料，就拿它來估算這次新 VM 的有效占用。

如果沒有歷史資料，就直接使用申請值，走保守模式。

## 白話判斷方式

現在系統不是在問：

`這台 VM 申請多少 CPU / RAM？`

而是在問：

`這台 VM 平常大概真的會吃多少？放到哪台 host 之後最不容易擠爆？`

判斷順序如下：

1. 看這台 VM 的 `CPU / RAM` 規格有沒有命中同類型歷史
2. 有歷史就估算有效 CPU / RAM
3. 沒歷史就直接用申請值
4. 把這台 VM 假設放到每一台可用 node 上
5. 比較放進去之後哪一台的壓力最低
6. 選那一台

## 現在實際會考慮什麼

### 1. 只使用 online node

如果某台 node 無法連線或狀態不是 `online`，就不拿來放置。

### 2. 先帶入 node 當前已用量

模擬不是從空白機器開始，而是先把 PVE 目前即時使用量帶進來。

例如：

- `cpu_used`
- `memory_used_gb`
- `disk_used_gb`

所以模擬結果會比較接近現在叢集真實狀態。

### 3. 用歷史資料估算有效 CPU / RAM

如果找到同類型歷史，就取該類型在目前時段的小時平均比例。

例如：

- `2 vCPU / 2 GiB`
- 09:00 的平均 CPU ratio = `0.18`
- 09:00 的平均 RAM ratio = `0.52`

那這台 VM 不會直接當成 `2 CPU / 2 GiB` 去放，而是先估算有效用量。

### 4. 沒歷史就保守處理

如果沒有同類型資料：

- CPU 直接用申請值
- RAM 直接用申請值
- Disk 直接用申請值

也就是不做縮小估算。

### 5. 歷史平均會排除 0 的影響

同類型歷史平均在建 profile 時，現在會忽略 `0` 值再計算平均。

原因是：

- 有些 VM 長時間 idle
- 有些 RRD 點本身不完整
- 如果把大量 0 一起平均，會把實際有在跑的 workload 壓得太低

因此現在邏輯是：

- 有非 0 樣本，就只用非 0 樣本做平均
- 全部都是 0 或沒有有效值，就視為沒有足夠歷史參考

## 現在有效用量怎麼算

目前只對 CPU 和 RAM 做歷史換算，Disk 仍使用申請值。

### CPU

公式概念：

`effective_cpu = min(requested_cpu, max(requested_cpu * cpu_ratio * 1.4, requested_cpu * 0.35))`

意思是：

- 先用歷史比例乘上安全係數 `1.4`
- 但最少也保留申請 CPU 的 `35%`
- 最多不超過原始申請值

### RAM

公式概念：

`effective_ram = min(requested_ram, max(requested_ram * memory_ratio * 1.15, requested_ram * 0.5))`

意思是：

- 先用歷史比例乘上安全係數 `1.15`
- 但最少也保留申請 RAM 的 `50%`
- 最多不超過原始申請值

### Disk

目前沒有依歷史縮小，直接用申請值。

原因是：

- Disk 容量不像 CPU 那樣適合大幅 overcommit
- 目前第一版主要先處理 CPU / RAM 放置邏輯

## 為什麼會放到某一台 node

現在系統會把 VM 分別假設放進每一台可用 node，再比較放入後的壓力。

使用的主要指標是：

`dominant share = max(CPU share, RAM share, Disk share)`

也就是：

- 看放進去後，哪個資源會最緊
- 哪台 node 的最緊資源比例最低，就優先選那台

如果 dominant share 一樣，再依序比較：

- 平均 share
- 目前已放數量
- node 名稱

## 一個白話例子

### vm-01

申請：

- CPU 2
- RAM 4G
- Disk 40G

如果沒有命中歷史：

- Effective CPU = 2
- Effective RAM = 4
- Effective Disk = 40

這台就會被當成比較重的 VM。

### vm-02

申請：

- CPU 2
- RAM 2G
- Disk 40G

如果命中 `2 vCPU / 2 GiB` 的歷史，而且歷史顯示它平常很輕：

- Effective CPU 可能變成 `0.7`
- Effective RAM 可能變成 `1.0`

那它就可能被放到像 `pve3` 這種容量較小、但仍放得下的 node。

## 目前這版還沒有考慮什麼

這版是刻意收斂過的 MVP，還沒有做：

- P95
- 尖峰持續時間
- host loadavg 對 admission 的直接限制
- I/O wait
- HA 預留
- 親和性 / 反親和性
- DRF
- 動態回收或 ballooning

所以它現在是：

`歷史平均導向的放置模擬器`

不是完整的動態資源控制器。

## 尖峰判斷應該怎麼處理

如果下一步要處理尖峰，建議不要直接看單一最大值，而是分成三層。

### 1. 常態值

用途：

- 日常放置
- 一般 admission

建議用：

- 同時段平均
- 或排除 0 後的平均

### 2. 保守值

用途：

- 初始保底
- 避免平均值太樂觀

建議用：

- 現在這版的 floor
- CPU 至少 `35%`
- RAM 至少 `50%`

### 3. 尖峰值

用途：

- 避免短時間大量 VM 同時爆量
- 當作 admission 的額外保護線

建議不要直接用最大值，而是改用：

- `P95`
- 或「高載持續超過 N 個點」的平均值

原因是：

- 最大值很容易只是短暫 spike
- 直接拿最大值會讓整體配置又回到過度保守

## 尖峰判斷的建議做法

如果你要做第二版，我建議這樣收斂：

### 方法 A：Average + Floor + Peak Guard

每台 VM 或每種類型 VM 計算：

- `base_cpu`
- `base_ram`
- `peak_cpu`
- `peak_ram`

放置時：

- 平常用 `base`
- admission 前再確認 node 是否還有足夠 peak buffer

可以理解成：

- 平常用平均值放
- 但保留一小段尖峰緩衝

### 方法 B：用 P95 取代平均

如果你覺得平均值還是太樂觀，可以把 CPU 或 RAM 改成：

- `effective_cpu = max(P95_cpu * margin, floor)`
- `effective_ram = max(P95_ram * margin, floor)`

這會比單純平均更保守，也更適合正式 admission。

### 方法 C：分時段尖峰保護

如果明顯有某些時段比較容易爆量，例如：

- 上課時間
- 夜間 batch
- 備份時間

就不要只看全月平均，而改看：

- 同時段平均
- 同時段 peak / P95

這樣 09:00 開 VM 和 23:00 開 VM 的判斷就可以不同。

## 我建議的下一步

如果只想在現在這版上再多一步，但不要把範圍拉太大，最適合的是：

1. 保留現在的 average-based placement
2. 另外為每個 profile 加一個 `peak guard`
3. 如果目標 node 放入後會吃掉 peak buffer，就標示 `risk high`
4. 先做提醒，不先做自動拒絕

這樣好處是：

- 邏輯不會突然變太複雜
- 使用者可以理解
- 審核者也能看到「可放，但尖峰風險偏高」

## 一句話總結

現在第一頁的邏輯是：

`有歷史就看同類型平常真的吃多少，沒歷史就保守用申請值，再把 VM 放到放入後最不擠的 node。`

如果下一步要處理尖峰，最適合的做法不是直接看最大值，而是：

`平均值做放置，floor 做保底，P95 或尖峰緩衝做風險保護。`
