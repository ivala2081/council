# Council v2 — Vizyon, Analiz ve Planlama Dokümanı

> Bu doküman Council v1'den v2'ye geçiş için yapılan tüm beyin fırtınasının kaydıdır.
> Amaç: Başka modeller ve kişilerle üzerinde düşünmek, planlamak, kararları olgunlaştırmak.

---

## BÖLÜM 1: VİZYON

### Ana Fikir

> **Council bir sanal yazılım şirketi.**
> 
> İçinde bir milyar dolarlık firmanın sahip olduğu tüm departmanlar var (Engineering, Product, Design, Marketing, Legal, Finance, HR...) ve her departmanın çalışanları (Agents) var.
>
> Kullanıcı bir fikir söylediğinde, Council bu fikri gerçek bir şirketin yaptığı gibi değerlendiriyor, planlıyor, ve isteğe bağlı olarak üretiyor.

### v1 ile Fark

| | v1 (mevcut) | v2 (vizyon) |
|---|---|---|
| Konsept | Startup değerlendirme aracı | Sanal yazılım şirketi |
| Ajanlar | 13 ajan, conveyor belt | 12 departman, gerçek organizasyon |
| İletişim | Sıralı (A→B→C) | Çok yönlü (iç iletişim + hiyerarşi) |
| Dış dünya | Yok (sadece LLM hayal) | Agent-Reach ile 17+ platform gerçek veri |
| Çıktı | Rapor/Brief | Değerlendirme + plan + opsiyonel yapım |
| Hafıza | Yok | Şirket hafızası, önceki projelerden öğrenme |

### Köşe Taşı Pozisyonlama

> *"Cursor kod yazar, Devin iş yapar. Council önce gerçek piyasa verisiyle fikrini test eder, sonra yönetim kurulundan geçirir, sonra planı verir — istersen yapar da."*

Council üç şeyi birleştiriyor, rakipler sadece birini yapıyor:
1. **Evaluation** — Verdict + puan + risk analizi
2. **Planning** — Departman bazlı iş planı, maliyet, timeline
3. **Real Market Data** — Agent-Reach ile gerçek Twitter/Reddit/LinkedIn verisi

---

## BÖLÜM 2: v1'İN DURUMU

### Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **AI:** @anthropic-ai/sdk + @ai-sdk/anthropic (Vercel AI SDK)
- **Database:** Supabase (PostgreSQL)
- **UI:** TailwindCSS 4 + shadcn/ui (base-nova)
- **Validation:** Zod 4
- **Code Sandbox:** @codesandbox/sandpack-react
- **PDF:** html2canvas + jspdf

### Proje Yapısı (Özet)

```
council/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Ana sayfa
│   │   ├── api/
│   │   │   ├── mission/route.ts     # Ana brief üretimi
│   │   │   ├── intake/route.ts      # Konuşmalı intake
│   │   │   ├── projects/            # Proje orkestrasyonu
│   │   │   └── threads/             # Thread yönetimi
│   │   ├── brief/[id]/              # Brief görüntüleme
│   │   └── thread/[id]/              # Thread görüntüleme
│   │
│   ├── components/
│   │   ├── genesis/                  # Genesis view
│   │   ├── brief-view.tsx            # Brief display
│   │   └── council-conversation.tsx  # Konuşma UI
│   │
│   └── lib/
│       ├── agents/                   # 13 ajan definition
│       ├── orchestrator/             # Phase state machine
│       ├── optimization/             # Model selection, token budgets
│       └── threads/                  # Thread management
│
├── supabase/migrations/              # 5 migration
└── benchmark/                        # Evaluation results
```

### Mevcut 13 Ajan

1. strategist — Chief strategist
2. architect — System architect
3. designer — Product design
4. backend_engineer
5. frontend_engineer
6. devops
7. devops_deploy
8. qa_writer
9. security
10. legal
11. marketing
12. product_manager
13. support_docs
14. triage — Request routing

### v1'in 6 Fazlı Pipeline'ı

```
Phase 1: Strategic Intake (strategist)
Phase 2: Product Definition (product_manager + legal)
Phase 3: Architecture & Design (architect + designer + security_threat)
Phase 4: Implementation (backend + frontend + devops + qa_writer) ⚠️ PLACEHOLDER
Phase 5: Verification & Hardening (qa_execution + security_audit + sre) ⚠️ PLACEHOLDER
Phase 6: Release & Operate (devops_deploy + marketing + support_docs)
```

### v1'deki Eksikler

- ❌ Phase 4-5 tool agents `return null` — kod üretimi, test, deploy çalışmıyor
- ❌ Ajanlar arası iletişim yok (sadece sıralı fazlar)
- ❌ Departman yapısı yok (düz liste)
- ❌ Şirket metaforu yok
- ❌ Gerçek dış dünya erişimi yok (Agent-Reach yok)
- ❌ Hafıza yok (önceki projelerden öğrenme yok)
- ❌ Hiyerarşi/karar zinciri yok (CEO, dept lead kavramı yok)
- ❌ Bütçe yönetimi basit token sayacı
- ❌ Dinamik ölçekleme yok (hep aynı 13 ajan)

**Vizyon yakınlığı:** ~%30 — iskelet var, ruh eksik.

---

## BÖLÜM 3: REFERANS KAYNAKLAR

### Referans 1: Claude Code (C:\repo\claude_ref\code)

**Ne:** Anthropic'in resmi CLI ajanı, TypeScript + Bun, ~1,900 dosya, 48K+ satır.

**Council v2 için çıkarımlar:**

#### Mimari Kalıplar
- **Tool-based agent spawning** (AgentTool): Sub-agent'ları background/foreground task olarak spawn et
- **Team-based swarm** (TeamCreateTool + SendMessageTool): Departman/ekip yapısı
- **In-process teammates**: Paralel senkron ajanlar
- **Permission system**: default/plan/bypass/auto modları
- **Hook system**: Session-scoped middleware
- **MCP integration**: Hem client hem server
- **Feature flags** (Bun bundle): Dead code elimination

#### Maliyet Optimizasyon Kalıpları (Claude Code'dan)

| Pattern | Tasarruf |
|---------|----------|
| Prompt caching (ephemeral + 1h TTL) | %60-90 input maliyeti |
| Model tiering (Haiku $1/$5, Sonnet $3/$15, Opus $15/$75) | %50-80 |
| Deferred tools / lazy loading | %10-30 |
| Context compaction (microcompact + full) | %70-85 faz arası |
| Output token capping (default 8K, P99 kullanım 4,911) | %50-70 output |
| Parallel tool execution (StreamingToolExecutor) | %50-60 latency |
| File state cache (LRU 100 entries, 25MB) | %20-40 |
| Smart escalation (Haiku → Sonnet → Opus) | %40-90 |
| Prefetch & speculation | %20-30 latency |

#### KRİTİK KEŞİF: Tek API Call ile Çok Tool

Claude Code'un asıl sırrı — **5 tool kullanan ajan 1 API call yapıyor, 5 değil.**

```
1 API Call → Model 5 tool_use döndürür → 5 tool paralel çalışır → 1 API Call (sonuçlarla)
Toplam: 2 API call ile 5 iş yapıldı
```

#### Error Handling Pattern'ları (17 adet)

1. **Exponential backoff + jitter:** 500ms × 2^n, ±25% jitter, max 32s
2. **429 handling:** Tier-aware retry (enterprise retry, standard bail)
3. **529 overload:** Max 3 retry → FallbackTriggeredError → lower model
4. **Token overflow:** Parse error, reduce max_tokens, retry (floor 3000)
5. **Stream interruption:** Non-streaming fallback on 404
6. **Stale connection:** ECONNRESET/EPIPE → disable keep-alive, fresh client
7. **Persistent retry:** 5 dk max backoff, 30s heartbeat chunks, 6 saat reset cap
8. **SSL errors:** Extract cause chain, provide proxy hints
9. **Tool failure classification:** `classifyToolError` → telemetry-safe
10. **Permission timeout:** Promise.race with timeout → fail-safe deny
11. **Auth refresh:** 401 → OAuth refresh, 403 → revoked detection
12. **Fast mode fallback:** Capacity → switch to standard, preserve cache
13. **Graceful shutdown:** Failsafe timer, 2s cleanup cap, 500ms analytics flush
14. **Conversation recovery:** Filter unresolved tool uses, inject continuation
15. **Compaction fallback:** Failed compact → continue with original
16. **Network retry:** APIConnectionError → always retryable
17. **Model fallback cascade:** Opus → Sonnet → Haiku

### Referans 2: Agent-Reach (C:\repo\Agent-Reach-main)

**Ne:** Python CLI v1.4.0, AI agent'lara 17+ sosyal/içerik platformunda internet erişimi sağlar.

**17 Platform:**
- Web (Jina Reader), YouTube (yt-dlp), GitHub (gh CLI), RSS, V2EX, Reddit (rdt-cli)
- Bilibili, Exa Search, Twitter/X (twitter-cli), Weibo, WeChat, Xiaohongshu
- Douyin/TikTok, LinkedIn, Xueqiu, Xiaoyuzhou podcast, Bilibili

**Council v2 için değer:** Marketing departmanının LLM hayali yerine **gerçek veri**:
- Twitter'da trend analizi
- Reddit'te kullanıcı tartışmaları
- LinkedIn'de rakip şirket profilleri
- YouTube'da sektör videoları
- GitHub'da rakip açık kaynak projeler

**Entegrasyon riski:** Python (Agent-Reach) ↔ TypeScript (Council) bridge — shell command veya HTTP API.

---

## BÖLÜM 4: DEPARTMAN YAPISI

### Gerçek Bir Şirketin Departmanları (Araştırma Sonucu)

Milyar dolarlık yazılım şirketlerinde **18 üst departman, 75+ alt birim** var:

1. Executive Leadership / CEO Office
2. Engineering (Frontend, Backend, Platform, Data, ML/AI, QA, Release, Security, DevEx, TPM)
3. Product Management (Core PM, Product Ops, Product Analytics, Technical PM, Product Strategy)
4. Design (Product Design, UX Research, Visual/Brand, Content Design, Design Systems, Motion, Design Ops)
5. Marketing (Product Marketing, Demand Gen, Content, Brand, DevRel, Community, Events, Marketing Ops, Partner, Localization)
6. Sales (SDR/BDR, AEs, Enterprise Sales, Solutions Engineering, Sales Ops, Channel, RevOps)
7. Customer Success (CSM, Onboarding, Support, Professional Services, Education, CS Ops, Trust & Safety)
8. Finance (FP&A, Accounting, Tax, Treasury, Billing, Internal Audit, IR, Procurement)
9. People/HR (Recruiting, People Ops, Comp & Benefits, L&D, People Analytics, DEIB, Employee Relations, HRBPs, Workplace)
10. Legal (Commercial, Employment, IP, Privacy, Regulatory, Corporate, Litigation, Public Policy)
11. IT (IT Ops, Enterprise Apps, IT Security, Network, IT Asset Management)
12. Security/InfoSec (SecOps, AppSec, GRC, IAM, Red Team, Security Architecture)
13. Data & Analytics (BI, Data Science, Product Analytics, Data Governance, Experimentation)
14. R&D / Innovation (Research Labs, Incubation, Emerging Tech)
15. Corporate Development / M&A
16. Communications / PR
17. Business Development / Partnerships
18. Specialized Functions (Localization, Accessibility, Sustainability/ESG, Real Estate)

### Council v2 için Sadeleştirilmiş 12 Departman

```
🏢 COUNCIL INC.
│
│  ══════════════════════════════════════
│   C-SUITE (Yönetim Katmanı)
│  ══════════════════════════════════════
│
├── 🎯 CEO Office (Strateji & Karar)
│   ├── Chief Strategist — vizyon, go/no-go kararı
│   └── Chief of Staff — departmanlar arası koordinasyon
│
├── 💻 CTO Office (Teknik Liderlik)
│   ├── VP Engineering — teknik yön, mimari kararlar
│   └── Security Architect — tehdit modelleme
│
├── 📦 CPO Office (Ürün Liderliği)
│   ├── VP Product — ne yapılacak, neden
│   └── UX Research Lead — kullanıcı ihtiyaçları
│
│  ══════════════════════════════════════
│   CORE DEPARTMENTS (Üretim)
│  ══════════════════════════════════════
│
├── 🏗️ Engineering Dept
│   ├── Backend Engineer
│   ├── Frontend Engineer
│   ├── DevOps / Platform Engineer
│   └── QA Engineer
│
├── 🎨 Design Dept
│   ├── Product Designer (UI/UX)
│   ├── Design System Engineer
│   └── Content Designer (UX writing)
│
├── 📊 Data & Analytics Dept
│   ├── Product Analyst
│   └── BI Analyst
│
│  ══════════════════════════════════════
│   BUSINESS DEPARTMENTS (Pazarlama & Satış)
│  ══════════════════════════════════════
│
├── 📢 Marketing Dept (Agent-Reach entegreli)
│   ├── Product Marketing — pozisyonlama, mesaj
│   ├── Market Research — gerçek pazar verisi
│   ├── Content Marketing — blog, tweet, içerik
│   └── Growth / SEO — organik büyüme
│
├── 💼 Sales & BD Dept
│   ├── Solutions Architect — teknik demo
│   └── BD Manager — partnerlik stratejisi
│
├── 🤝 Customer Success Dept
│   ├── Support Lead — dokümantasyon
│   └── Onboarding Specialist — müşteri eğitimi
│
│  ══════════════════════════════════════
│   SUPPORT DEPARTMENTS (Destek)
│  ══════════════════════════════════════
│
├── ⚖️ Legal & Compliance Dept
│   ├── Privacy Counsel — GDPR/KVKK
│   ├── IP Counsel — patent, lisans
│   └── Commercial Counsel — sözleşme
│
├── 💰 Finance Dept
│   ├── FP&A — bütçe, maliyet analizi
│   ├── Billing — fiyatlandırma modeli
│   └── Procurement — vendor yönetimi
│
└── 👥 HR / People Dept
    ├── Talent Acquisition — "ajan işe alım"
    └── Performance Analytics — ajan performansı
```

**Toplam:** 12 departman, 28 rol

### Departmanlar Nasıl Görünecek? — 5 Alternatif

Kullanıcı 12 departmanı doğrudan görmez. Seçilen gösterim stratejisi:

#### Alternatif A: Progressive Disclosure
Varsayılan: Sadece CEO raporu + 3 kritik departman. "Daha fazla göster" butonu ile diğerleri açılır.

#### Alternatif B: Dynamic Department Selection (ÖNERİLEN)
Triage projeye göre departmanları seçer:
- Blog sitesi → 3 departman
- Fintech → 8 departman
- AI startup → 10 departman
- Enterprise → 12 departman

#### Alternatif C: Filtered Views by Persona
Kullanıcı başlangıçta rolünü seçer: [Girişimci] [Geliştirici] [Öğrenci]

#### Alternatif D: Quick Summary + Deep Dive
Ana sayfa 1 paragraf özet, "Departman raporları" sekmesi.

#### Alternatif E: Output-Driven (ÖNERİLEN)
Departmanları gösterme, 3 büyük "output paket" göster:
- "Fikir analizi" (CEO + Market)
- "Teknik plan" (Eng + Design + DevOps)
- "İş planı" (Finance + Marketing + Legal)

**Önerilen kombinasyon:** B + E. Backend adaptive 12 departman, UI 3 output paketi.

---

## BÖLÜM 5: İLETİŞİM STRATEJİSİ

### İletişim Tipleri

```typescript
type MessageType = 
  | "request"      // İş talebi: "Bunu yap"
  | "deliverable"  // Teslim: "İşte sonuç"
  | "review"       // İnceleme: "Buna bak, görüşünü söyle"
  | "approval"     // Onay: "Onaylıyor musun?"
  | "broadcast"    // Duyuru: "Herkes bilsin"
  | "escalation"   // Yükseltme: "Bunu çözemedim, üste taşı"
```

### İletişim Kanalları

1. **Dikey (Yukarı/Aşağı):** CEO ↔ CTO ↔ Engineering Lead ↔ Backend Engineer
2. **Yatay (Departmanlar arası):** Product → Engineering, Marketing → Sales
3. **Broadcast:** CEO → ALL: "Proje onaylandı"
4. **Peer Review:** Backend ↔ Frontend: "API kontratı bu olsun"

### İletişim Matrisi (Kim Kiminle Konuşur)

```
              CEO  CTO  CPO  ENG  DES  DAT  MKT  SAL  CS   LEG  FIN  HR
CEO            ·    ●    ●    ○    ○    ○    ○    ○    ○    ●    ●    ○
CTO            ●    ·    ●    ●    ○    ○    ·    ·    ·    ○    ○    ·
CPO            ●    ●    ·    ●    ●    ●    ●    ○    ●    ○    ·    ·
Engineering    ○    ●    ●    ·    ●    ○    ·    ·    ○    ○    ·    ·
Design         ○    ○    ●    ●    ·    ○    ●    ·    ·    ·    ·    ·
Data           ○    ○    ●    ○    ○    ·    ●    ○    ○    ·    ●    ·
Marketing      ○    ·    ●    ·    ●    ●    ·    ●    ○    ○    ○    ·
Sales          ○    ·    ○    ·    ·    ○    ●    ·    ●    ●    ●    ·
CS             ○    ·    ●    ○    ·    ○    ○    ●    ·    ○    ·    ·
Legal          ●    ○    ○    ○    ·    ·    ○    ●    ○    ·    ●    ●
Finance        ●    ○    ·    ·    ·    ●    ○    ●    ·    ●    ·    ○
HR             ○    ·    ·    ·    ·    ·    ·    ·    ·    ●    ○    ·

● = Sık iletişim    ○ = Ara sıra    · = Nadir/yok
```

### Memo Sistemi (Maliyet-Verimli İletişim)

Departmanlar arası her mesaj **bir API call değil**. Memo sistemi:
1. Phase çalışır → Tüm departman çıktıları "memo" olarak bus'a yazılır (LOCAL, 0 API call)
2. Sonraki faz bu memo'ları context olarak alır
3. TEK API call ile tüm memo'lar işlenir

```typescript
interface DeptMessage {
  id: string
  from: DepartmentId
  to: DepartmentId | "ALL"
  type: MessageType
  priority: "critical" | "normal" | "low"
  payload: any
  requires_response: boolean
  deadline_phase: number
}

class CompanyBus {
  private mailboxes: Map<DepartmentId, DeptMessage[]>
  
  send(msg: DeptMessage) {
    this.mailboxes.get(msg.to)?.push(msg)
  }
  
  broadcast(from: DepartmentId, payload: any) {
    for (const dept of this.mailboxes.keys()) {
      this.send({ from, to: dept, type: "broadcast", payload, ... })
    }
  }
  
  collectForPhase(phase: number): Map<DepartmentId, DeptMessage[]> {
    return this.drainMailboxes(phase)
  }
}
```

---

## BÖLÜM 6: MİMARİ — "COMPANY BRAIN"

### Ana Fikir: Her Ajan Ayrı API Call Değil

**v1 sorunu:**
```
Her ajan = ayrı API call:
CEO($0.03) + Architect($0.03) + Designer($0.03) + ... 10 call = ~$0.25/request
```

**v2 çözümü:** Departmanları ayrı API call değil, **tool** olarak tanımla. Tek API session içinde model hangi departmanı aktive edeceğine karar versin.

```typescript
// Her departman bir TOOL
const companyTools = [
  {
    name: "engineering_dept",
    description: "Backend/Frontend/DevOps analizi yapar",
    input_schema: { task: string, context: string }
  },
  {
    name: "marketing_dept", 
    description: "Pazar araştırması ve strateji üretir (Agent-Reach ile gerçek veri)",
    input_schema: { task: string, brief: string }
  },
  // ... diğer departmanlar
]
```

### 3 Kademeli Mimari

```
┌─────────────────────────────────────────────┐
│  KADEME 1: LOCAL ORCHESTRATOR (0 API call)  │
│  TypeScript state machine                    │
│  - Departman routing                         │
│  - Tool result caching                       │
│  - Context management                        │
│  - Approval gates                            │
│  - Agent-Reach calls (dış araştırma)        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  KADEME 2: TOOL-USE LOOP (1-2 API call)     │
│  Tek API session, çok departman              │
│  - Model CEO gibi düşünür                    │
│  - Departmanları tool olarak çağırır         │
│  - Paralel tool execution                    │
│  - Streaming response                        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  KADEME 3: ESCALATION (nadir, 1 API call)   │
│  Sadece karmaşık durumlar için               │
│  - Opus ile derin analiz                     │
│  - Güvenlik kritik kararlar                  │
│  - Çelişki çözümü                            │
└─────────────────────────────────────────────┘
```

### Local vs LLM Departmanlar

**LOCAL (0 API call) — template/rule-based:**
- Finance (hesaplama)
- Legal (compliance checklist)
- QA (test template)
- DevOps (infra template)
- Support Docs (template)
- HR (metrik toplama)
- Triage (keyword routing)

**LLM GEREKLİ (tool-use loop içinde):**
- CEO (strateji, karar)
- Architect (yaratıcı tasarım)
- Product Manager (kullanıcı analizi)
- Designer (yaratıcı UX)
- Marketing (içerik yazımı)

**Sonuç:** 12 departmandan 7'si local, 6'sı tek API session'da tool olarak.

### Maliyet Karşılaştırması

```
v1 (her ajan ayrı call):
  10 API call × ~2K input × ~2K output
  ≈ $0.25/request

v2 Company Brain:
  Kademe 1 (local): 7 departman × 0 call = $0.00
  Kademe 2 (tool-use): 2 call × ~4K input × ~4K output
    + prompt cache hit (%90) input maliyeti %10
  ≈ $0.02-0.05/request

TASARRUF: 5-12x ucuz, aynı veya daha iyi kalite
```

---

## BÖLÜM 7: MALİYET OPTİMİZASYONU

### Claude Code'dan Alınan 9 Teknik

#### 1. Prompt Caching
```typescript
system: [{
  type: "text",
  text: systemPrompt,
  cache_control: { type: "ephemeral" }  // 5 dk cache (1h optional)
}]
```
**Tasarruf:** %60-90 input maliyeti (cache hit durumunda read 10x ucuz)

#### 2. Model Tiering
```
Haiku ($1/$5):     Triage, sınıflandırma, HR, Finance hesap
Sonnet ($3/$15):   Çoğu departman çalışanı
Opus ($15/$75):    CEO kararları, kritik mimari, güvenlik
```
**Tasarruf:** Haiku Opus'tan 15x ucuz

#### 3. Deferred Tools
Her departman kendi tool setini görür. CEO tümünü, Engineer sadece engineering tool'larını.
**Tasarruf:** Agent başına ~5-20K token

#### 4. Context Compaction
```
Phase 1 çıktısı: 5000 token (tam rapor)
Phase 2'ye giden: 800 token (özet)  ← %84 tasarruf
```

#### 5. Output Token Capping
```
Triage/HR/CFO:        max 2K token
Product/Legal/QA:     max 4K token
Engineer/Architect:   max 8K token
CEO (final rapor):    max 16K token
```
**Tasarruf:** Output %50-70 azalma

#### 6. Parallel Execution
Bağımsız departmanlar `Promise.all` ile paralel çalışır. Süre %50-60 kısalır.

#### 7. File State Cache (LRU)
Aynı proje verisini tekrar tekrar okuma. 100 entry, 25MB cache.

#### 8. Smart Escalation
```
Basit: Haiku → bitti
Orta: Haiku → Sonnet → bitti
Karmaşık: Haiku → Opus → bitti
```

#### 9. Prefetch & Speculation
Kullanıcı yazarken arka planda triage başlat, ajan system prompt'larını warm-up yap.

### Toplam Etki

Hepsini uygularsan: **Aynı kalitede çıktı, 5-10x daha ucuz.**

---

## BÖLÜM 8: HATA YÖNETİMİ (RESILIENCE)

### Claude Code'dan 17 Error Handling Pattern

| Pattern | Kullanım |
|---------|----------|
| Exponential backoff + jitter (500ms × 2ⁿ, ±%25) | Tüm API retry |
| 429 tier-aware retry | Rate limit handling |
| 529 overload → model fallback (max 3 retry) | Overload → lower tier |
| Token overflow → parse + reduce max_tokens | Context limit |
| Stream 404 → non-streaming fallback | Stream interrupt |
| ECONNRESET/EPIPE → disable keep-alive + fresh client | Stale connection |
| Persistent retry (5 dk max, 30s heartbeat, 6h reset) | Unattended sessions |
| SSL error → extract cause + hints | Corporate proxy |
| `classifyToolError` → telemetry-safe | Tool failure |
| Permission timeout → fail-safe deny | Permission check |
| 401 → OAuth refresh, 403 → revoked detect | Auth failure |
| Fast mode cooldown on 429 | Capacity mgmt |
| Graceful shutdown (2s cleanup, 500ms analytics) | Exit |
| `filterUnresolvedToolUses` + continuation | Mid-turn interrupt |
| Compaction fail → original messages | Compact error |
| APIConnectionError always retryable | Network |
| Model fallback cascade (Opus → Sonnet → Haiku) | Persistent fail |

### Council v2 Resilience Mimarisi

```typescript
// src/lib/resilience/
├── withRetry.ts          // Claude Code pattern
├── errorClassifier.ts    // Telemetry-safe error mapping
├── fallbackCascade.ts    // Model degradation
├── compactRecovery.ts    // Phase output compaction fallback
└── agentReachFallback.ts // Agent-Reach timeout → cached data
```

---

## BÖLÜM 9: TAM SİMÜLASYON ÖRNEĞİ

**Senaryo:** *"Online terapi platformu yapmak istiyorum. Terapistler ve hastalar video görüşme yapabilecek, notlar tutulacak, ödeme sistemi olacak."*

### Phase 0: Triage (LOCAL, 0 API call)
```
⏱️ 0.5 sn | $0.00
Keywords: ["terapi", "video", "ödeme", "sağlık"]
Complexity: COMPLEX (HIPAA/KVKK + WebRTC + PCI)
Mode: Normal (Draft & Review)
Required departments: ALL
Model tier: Sonnet (CEO) + Haiku (destek)
```

### Phase 1: CEO Strategic Assessment (1 API call — Sonnet)
```
⏱️ 3 sn | $0.03

Model tool_use ile departmanları aktive eder:
→ market_research() — Agent-Reach ile Twitter/Reddit/LinkedIn
→ legal_review() — HIPAA/KVKK checklist
→ finance_assessment() — maliyet hesabı

Tool'lar LOCAL çalışır paralel, 0 API call:

market_research:
  Twitter: 15K tweet/hafta "teletherapy", %68 pozitif
  Reddit: r/therapy — "BetterHelp overpriced" 2.3K upvote
  LinkedIn: 340 iş ilanı (büyüyen pazar)

legal_review:
  HIPAA: BAA gerekli, encryption, audit logs
  KVKK: açık rıza, saklama süresi, silme hakkı
  Video: çift taraflı kayıt onayı

finance_assessment:
  MVP: WebRTC ($50) + Stripe (2.9%) + DB ($25) = $200/ay
  Breakeven: 50 terapist × $49/ay

CEO sentez:
  Verdict: PROMISING (72/100)
  Görev dağılımı: CTO, CPO, Marketing, Legal
```

### Phase 2: Product & Architecture (1 API call — Sonnet, cache hit)
```
⏱️ 5 sn | $0.04

tool_use: product_definition() → User journey + feature list
tool_use: architecture_design() → Next.js + Supabase + Twilio + Stripe
tool_use: security_threat_model() → STRIDE for healthcare
```

### Phase 3: Engineering & Design (1 API call — Sonnet)
```
⏱️ 8 sn | $0.05

tool_use: frontend_spec() — Component tree
tool_use: backend_spec() — Schema + API endpoints
tool_use: design_spec() — Design tokens
tool_use: devops_plan() — Vercel + Supabase
```

### Phase 4: Go-to-Market & Support (1 API call — Haiku)
```
⏱️ 3 sn | $0.005

tool_use: marketing_strategy() — Agent-Reach hashtag analizi
tool_use: documentation() — Doc template
tool_use: pricing_model() — Rekabetçi fiyat
```

### Phase 5: Final Synthesis (1 API call — Sonnet)
```
⏱️ 3 sn | $0.03

CEO final rapor:
  Verdict: PROMISING (72/100)
  Tech Stack: Next.js + Supabase + Twilio + Stripe
  MVP Maliyet: $200/ay
  Breakeven: 50 terapist × $29/ay
  Timeline: 6 hafta MVP, 12 hafta public launch
```

### Toplam Maliyet

```
Phase 0: Triage (local)              $0.000  |  0.5 sn
Phase 1: CEO Assessment (Sonnet)     $0.030  |  3 sn
Phase 2: Product & Arch (Sonnet)     $0.040  |  5 sn (cache hit)
Phase 3: Engineering (Sonnet)        $0.050  |  8 sn
Phase 4: Go-to-Market (Haiku)        $0.005  |  3 sn
Phase 5: Final Synthesis (Sonnet)    $0.030  |  3 sn
────────────────────────────────────────────────────
TOPLAM:                              $0.155  |  22.5 sn
API calls:                           5 (v1'de 10-13)
Local tool çalıştırma:               15+
Gerçek pazar verisi:                 ✅ (Agent-Reach)

vs v1: $0.25, 45-60 sn, 0 gerçek veri
→ %38 daha ucuz, %60 daha hızlı, gerçek veri ile
```

---

## BÖLÜM 10: KULLANICI DENEYİMİ — MOD SEÇENEKLERİ

### 5 Alternatif Mod

#### 1. Board Meeting Mode (Yönetim Kurulu)
Her adımda kullanıcı onayı. En çok kontrol, en yavaş.

#### 2. Autopilot Mode (Tam Otonom)
Kullanıcı sadece sonucu görür. En hızlı, en az friction.

#### 3. Draft & Review Mode (ÖNERİLEN)
Hızlı taslak → kullanıcı onayı → full analiz. Ucuz doğrulama.

#### 4. Progressive Mode (Kademeli Derinleşme)
```
Seviye 1 (ücretsiz): Tek cümle verdict
Seviye 2 ($0.02): Departman özetleri
Seviye 3 ($0.08): Full Company Brain
Seviye 4 ($0.20): Opus + Agent-Reach derin
```

#### 5. Smart Auto Mode (Akıllı Otomatik)
Triage karmaşıklığa göre modu seçer.

### Önerilen UX

```
┌─────────────────────────────────────────┐
│  Nasıl çalışmamı istersin?              │
│                                         │
│  ⚡ Hızlı    — Direkt sonuç ver         │
│  📋 Normal   — Taslak göster, onaylat   │  ← varsayılan
│  🏛️ Detaylı  — Her adımda onay iste     │
│                                         │
│  (Sistem karmaşıklığa göre önerir)      │
└─────────────────────────────────────────┘
```

| Mod | API Calls | Maliyet | Süre | Kontrol |
|-----|-----------|---------|------|---------|
| Hızlı | 2-3 | $0.02-0.05 | 5-10 sn | Düşük |
| Normal | 3-4 | $0.05-0.10 | 10-20 sn | Orta |
| Detaylı | 4-6 | $0.10-0.25 | 30-60 sn | Yüksek |

---

## BÖLÜM 11: KULLANICI SEGMENTLERİ

### 4 Segment

```
Segment A: Fikir Sahibi / Girişimci
  İster: "Fikrim iyi mi? Para kazanır mı?"
  Alır: CEO verdict + market research + maliyet
  Mod: Hızlı

Segment B: No-Code / Vibe Coder  
  İster: "Basit bir web sitesi yap"
  Alır: Çalışan kod + deployment talimatı
  Mod: Normal

Segment C: Teknik Geliştirici
  İster: "Karmaşık mimari, best practices"
  Alır: Full şirket simülasyonu, architecture docs
  Mod: Detaylı

Segment D: Öğrenmeye Çalışan
  İster: "Nasıl yapılır, neden böyle?"
  Alır: Açıklamalı çıktı, "öğretici mod"
  Mod: Explain
```

---

## BÖLÜM 12: COMPETITIVE LANDSCAPE

### Rakip Matrisi (Nisan 2026)

| Ürün | Ne Yapar | Fiyat | Güçlü | Zayıf |
|------|----------|-------|-------|-------|
| **MetaGPT** | Multi-agent SW şirketi | Open source | Structured SOP | Code only, framework |
| **ChatDev** | Sanal SW şirketi, dialog | Open source | Quality metrics | Code only, research |
| **CrewAI** | Multi-agent orchestration | OS + paid | Esneklik, role-based | Framework, not product |
| **Devin** | Otonom AI yazılım mühendisi | $20-500/ay + $2.25/ACU | Gerçek coding | Sadece kod, pahalı |
| **Bolt.new** | AI app builder browser | Free → $25/ay | Preview, hosting | Frontend-heavy |
| **Lovable** | AI app builder | Free → $25 → $50/ay | Full-stack + Supabase | Web app only |
| **Cursor** | AI code editor | Free → $20 → $40/user | IDE integration | Developer only |
| **v0.dev** | UI component generator | Free → paid | Shadcn/Tailwind | UI only |
| **AutoGen** | Multi-agent framework | OS | Research/POC | Not production |

### Pazar Boşluğu

Hiçbiri şunları BİRLİKTE yapmıyor:
1. **Fikirden** başlayan (kod/başlangıç noktası yok)
2. **İş tarafına** odaklanan (sadece kod değil, pazar + hukuk + finans)
3. **Gerçek veri** ile çalışan (hallüsinasyon değil, Agent-Reach)
4. **Herkes için** erişilebilir (developer olmaya gerek yok)
5. **Şirket metaforu** ile sunulan (anlaşılır UX)

### Stratejik Karar Noktaları

**Karar 1: Council kod yazar mı?**
- ✅ Yazarsa → Bolt/Lovable rakibi (zor savaş)
- ❌ Yazmazsa → Niş ama differentiated
- **Önerilen orta yol:** "Başlangıç paketi" üret (scaffold + README + roadmap), full build değil

**Karar 2: Hedef kitle?**
- Developer pazarında Cursor/Devin hakim, kırmak zor
- Girişimci/iş pazarı daha az doymuş
- **Önerilen:** Non-technical founder + early-stage girişimci

**Karar 3: Framework mi, ürün mü?**
- **Önerilen:** Ürün (web app), framework değil

---

## BÖLÜM 13: MONETİZASYON

### 2026 Trendi

Araştırma: **Hybrid pricing 2026 standardı** (%61 SaaS, %85 AI lider). Saf usage-based veya saf subscription öldü.

### Council v2 Öneri: 3-Tier Hybrid

```
┌─────────────────────────────────────────────┐
│  FREE (Acquisition)                         │
│  - 3 değerlendirme/ay                       │
│  - Hızlı mod only                           │
│  - Agent-Reach yok                          │
│  - "Powered by Council" branding            │
│  Maliyet: ~$0.05/kullanıcı                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  STARTER — $15/ay  (Ana hedef)              │
│  - 30 değerlendirme/ay                      │
│  - Tüm modlar                               │
│  - Agent-Reach (100 arama/ay)               │
│  - PDF export                               │
│  - Thread history                           │
│  Maliyet: ~$4.5/kullanıcı → $10.5 kar       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  PRO — $49/ay  (Power user)                 │
│  - Sınırsız değerlendirme                   │
│  - Opus mod                                 │
│  - Agent-Reach sınırsız                     │
│  - Custom departmanlar                      │
│  - Team (3 kullanıcı)                       │
│  - API access                               │
│  Maliyet: ~$15/kullanıcı → $34 kar          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  PAY-AS-YOU-GO (Pro üstü)                   │
│  - $0.50/değerlendirme (extra)              │
│  - $2/Agent-Reach deep research             │
└─────────────────────────────────────────────┘
```

### Neden $15 ana tier?
- Rakipler $20-25: **fiyat avantajı şart**
- $15 "impulse buy" bölgesinde
- Break-even: ~200 Pro kullanıcı

### Unit Economics
- Ortalama Starter: $15 gelir - $4.5 maliyet = **$10.5 kar/ay**
- LTV/CAC hedefi: 3x

---

## BÖLÜM 14: LOCAL TOOL STRATEJİSİ

### Template-Based Code Generation

| Tool | Pros | Use Case |
|------|------|----------|
| **Hygen** | EJS, hızlı, file-based | Component/page generation |
| **Plop** | Handlebars, programmatic | Structured output |
| **Eta** | TypeScript-native, modern | En iyi seçim |

### Rule Engines (Legal/Compliance)

| Tool | Özellikler |
|------|-----------|
| **json-rules-engine** | Declarative, JSON-based, ~3k★ |
| **Rools** | TypeScript support, function-based |
| **node-rules** | Forward chaining, stable |

**Önerilen:** `json-rules-engine` (declarative, serializable, test edilebilir)

### Validation & Structured Output

- **Zod** — Schema validation (v1'de zaten var)
- **JSON Schema** — Language-agnostic

### Hybrid Pattern (Template + LLM)

```typescript
// Örnek: Legal departmanı
function generateLegalReport(input: LegalInput): LegalReport {
  // 1. LOCAL: Static checklist
  const checklist = runComplianceChecklist(input.domain, LEGAL_RULES)
  
  // 2. LOCAL: Template doldur
  const baseReport = renderTemplate('legal-report.eta', { checklist, input })
  
  // 3. LLM (opsiyonel): Kritik risk varsa
  if (checklist.criticalRisks.length > 0) {
    return enhanceWithLLM(baseReport, checklist.criticalRisks)
  }
  
  return baseReport  // API call yok
}
```

**%80 template + %20 LLM enhancement = optimum kalite/maliyet**

### Önerilen Stack

```
Templates:   Eta (primary) + Hygen (scaffolding)
Validation:  Zod (mevcut)
Rules:       json-rules-engine
Math:        Native + decimal.js
Scanning:    Semgrep (Phase 5 QA)
Formats:     Markdown + structured JSON
```

---

## BÖLÜM 15: MODEL SEÇİMİ

### Seçenekler

| Model | Input/Output (per Mtok) | Güç | Kullanım |
|-------|-------------------------|-----|----------|
| Claude Haiku 4.5 | $1 / $5 | Orta | Triage, routing, local fallback |
| Claude Sonnet 4.6 | $3 / $15 | Yüksek | Çoğu departman, ana iş |
| **Claude Opus 4.6** | **$15 / $75** | **En Yüksek** | CEO, Architect, kritik |
| GPT-5 (OpenAI) | Benzer | Yüksek | Alternatif provider |
| Gemini 2.5 Pro | Benzer | Yüksek | 2M context, multimodal |
| DeepSeek V3 | $0.27 / $1.1 | Orta-Yüksek | Çok ucuz code-heavy |
| Llama 4 / Qwen | Self-hosted | Değişken | 0 API maliyet, altyapı |

### Önerilen Mix

```
CEO + Architect (kritik):         Opus 4.6
Çoğu departman (standart):        Sonnet 4.6
Triage + classification:          Haiku 4.5
Agent-Reach (external research):  Local (no LLM)
Fallback (provider diversity):    DeepSeek V3 (opsiyonel)
```

**Neden Claude ecosystem?** Prompt caching, tool-use patterns, agent consistency, aynı token counting.

---

## BÖLÜM 16: PM DEĞERLENDİRMESİ

### Artılar
1. ✅ Vizyon güçlü ve differentiating (AI virtual company niş)
2. ✅ v1 çalışan iskelet sunuyor (sıfırdan değil)
3. ✅ Agent-Reach gerçek değer katıyor (hallüsinasyon çözümü)
4. ✅ Maliyet optimizasyon stratejisi sağlam
5. ✅ Kullanıcı kontrol modları doğru yaklaşım
6. ✅ Hybrid mimari teknik olarak akıllıca

### Eksiler / Riskler
7. ⚠️ Scope çok büyük → kabul edildi, devam
8. ⚠️ Kullanıcı segmentasyonu net → 4 segment tanımlandı
9. ⚠️ 12 departman anlamsız → Alternatif B+E ile çözüldü
10. ⚠️ Happy path → Claude Code 17 pattern uyarlandı
11. ⚠️ Şirket hissi vs değer → Adaptive mode (Yol C)
12. ⚠️ Agent-Reach Python-TypeScript → HTTP bridge gerekli
13. ⚠️ Competitive landscape → analiz edildi, gap belirlendi
14. ⚠️ Monetizasyon → 3-tier hybrid kararlaştırıldı
15. ⚠️ v1 Phase 4-5 placeholder → v2'de düzeltilecek
16. ⚠️ Local tool kalitesi → Eta + json-rules-engine + Zod stack
17. ⚠️ Solo dev riski → Claude ile yapılabilir (kabul)

---

## BÖLÜM 17: KARAR VERİLMESİ GEREKENLER

### Onay Bekleyen 8 Karar

| # | Karar | Önerim | Status |
|---|-------|--------|--------|
| 1 | Departman UI | Alternatif B + E (adaptive + output-driven) | ⏳ |
| 2 | Şirket hissi vs değer | Yol C (Adaptive — triage karar verir) | ⏳ |
| 3 | Ana LLM | Opus (kritik) + Sonnet (çoğu) + Haiku (triage) | ⏳ |
| 4 | Differentiation | "Fikir → tam strateji, gerçek veriyle" | ⏳ |
| 5 | Kod yazar mı? | Scaffold evet, full build hayır | ⏳ |
| 6 | Hedef kitle | Non-technical founder + indie hacker | ⏳ |
| 7 | Monetizasyon | Free → $15 Starter → $49 Pro | ⏳ |
| 8 | Stack | TypeScript + Next.js + Eta + Zod | ⏳ |

---

## BÖLÜM 18: v2 ROADMAP TASLAĞI

### Fazlandırma (önerilen sıralama)

#### v2.0 — Core Foundation
- v1 Phase 4-5 düzeltme (tool agents çalışır hale getir)
- Company Brain mimarisi (tek API session, tool-use loop)
- Prompt caching (tüm ajanlar)
- Model tiering (Opus/Sonnet/Haiku mix)
- Resilience layer (17 pattern'dan kritik 5'i)
- Basic departman UI (C-suite view)
- 3 departman aktif: CEO + Engineering + Marketing

#### v2.1 — Real World Access
- Agent-Reach entegrasyonu (Python bridge)
- Marketing departmanı → gerçek Twitter/Reddit/LinkedIn verisi
- Kullanıcı modları (Hızlı/Normal/Detaylı)
- 6 departman aktif (+ Design + Legal + Finance)

#### v2.2 — Full Company
- 12 departman aktif
- Adaptive department selection (triage bazlı)
- Inter-department communication (memo sistemi)
- Local tool ecosystem (Eta templates, json-rules-engine)
- Output-driven UI (3 paket)

#### v2.3 — Intelligence Layer
- Şirket hafızası (önceki projelerden öğrenme)
- CFO departmanı (akıllı bütçe yönetimi)
- HR departmanı (ajan performans takibi)
- Dinamik ölçekleme

#### v2.4 — Monetization & Growth
- Subscription tiers (Free/Starter/Pro)
- Pay-as-you-go add-on
- Team collaboration
- API access
- Analytics dashboard

#### v2.5 — Studio Mode
- "Şirketi izle" UX (canlı simülasyon)
- Board meeting mode
- Custom department creation
- Viral sharing features

---

## BÖLÜM 19: SONUÇ VE SONRAKİ ADIMLAR

### Özet

Council v2, v1'in "danışmanlık paneli" konseptinden **"sanal yazılım şirketi"** konseptine evrim.

- **Vizyon:** Milyar dolarlık şirketin tüm departmanlarına sahip AI sanal şirket
- **Differentiator:** Evaluation + Planning + Real Data, hep birlikte
- **Teknik strateji:** Company Brain (tek API session, çok tool)
- **Maliyet stratejisi:** Claude Code pattern'larından 9 teknik
- **Kalite stratejisi:** Hybrid (local template + LLM enhancement)
- **UX stratejisi:** Adaptive (triage karar verir, kullanıcı modu seçer)
- **Monetizasyon:** 3-tier hybrid pricing

### Sonraki Adımlar

1. **8 karar noktasını onayla** (Bölüm 17)
2. **v2.0 detaylı implementation planı** yaz
3. **v1 Phase 4-5 düzeltme** prioritize et
4. **Company Brain PoC** yap
5. **İlk 3 departman** implement et (CEO, Engineering, Marketing)

---

## EK: KAYNAKLAR VE REFERANSLAR

### İç Referanslar
- Council v1 kaynak kodu: `c:\Users\ACER\Documents\GitHub\council\`
- Claude Code reference: `C:\repo\claude_ref\code`
- Agent-Reach reference: `C:\repo\Agent-Reach-main`

### Dış Kaynaklar

**Multi-Agent Frameworks:**
- [Top 5 AI Agent Frameworks 2026 - Intuz](https://www.intuz.com/blog/top-5-ai-agent-frameworks-2025)
- [LangGraph vs CrewAI vs AutoGen 2026](https://o-mega.ai/articles/langgraph-vs-crewai-vs-autogen-top-10-agent-frameworks-2026)
- [MetaGPT vs ChatDev](https://smythos.com/ai-agents/ai-agent-builders/metagpt-vs-chatdev/)
- [What is MetaGPT - IBM](https://www.ibm.com/think/topics/metagpt)
- [What is ChatDev - IBM](https://www.ibm.com/think/topics/chatdev)

**AI Code Builders:**
- [Cursor vs Bolt vs Lovable 2026](https://lovable.dev/guides/cursor-vs-bolt-vs-lovable-comparison)
- [AI App Builder Pricing 2026 - Taskade](https://www.taskade.com/blog/best-bolt-new-alternatives)
- [Best AI App Builder 2026 - Mocha](https://getmocha.com/blog/best-ai-app-builder-2026/)
- [Devin 2.0 Pricing - VentureBeat](https://venturebeat.com/programming-development/devin-2-0-is-here-cognition-slashes-price-of-ai-software-engineer-to-20-per-month-from-500)
- [Devin Pricing - Lindy](https://www.lindy.ai/blog/devin-pricing)

**AI Monetization:**
- [2026 AI Agent Pricing Playbook - Chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)
- [2026 Guide to AI Pricing Models - Monetizely](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models)
- [AI Monetization Seats/Tokens/Hybrid - Data-Mania](https://www.data-mania.com/blog/ai-monetization-seats-tokens-hybrid-models/)
- [AI Pricing Playbook - Bessemer Venture Partners](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)

**Local Tools & Templates:**
- [TypeScript Code Generation Tools Comparison](https://github.com/Ofadiman/code-generation-tools-comparison)
- [Hygen Code Generator](https://github.com/jondot/hygen)
- [json-rules-engine](https://github.com/CacheControl/json-rules-engine)
- [5 Best Node.js Rule Engines](https://www.nected.ai/blog/rule-engine-in-node-js-javascript)

---

*Bu doküman bir canlı dokümandır. Beyin fırtınası ilerledikçe güncellenebilir.*
*Son güncelleme: 2026-04-06*
