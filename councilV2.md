# Council v2 — Vizyon, Analiz ve Planlama Dokümanı

> Bu doküman Council v1'den v2'ye geçiş için yapılan tüm beyin fırtınasının kaydıdır.
> Amaç: Başka modeller ve kişilerle üzerinde düşünmek, planlamak, kararları olgunlaştırmak.
>
> **Son büyük revizyon:** Ürün psikolojisi perspektifiyle yeniden yazıldı.
> Eski çerçeve ("sanal yazılım şirketi") teknik arka plan haline geldi.
> Yeni çerçeve: **"AI investor, dürüst cevap verir."**

---

## BÖLÜM 1: VİZYON VE POZİSYONLAMA

### Tek Cümle Promise

> **Council, fikrin hakkında kimsenin söyleyemediği gerçeği söyleyen bir AI yatırımcıdır.**

### Neden Bu Cümle?

Her kelime bir işe yarıyor:

| Kelime | İşlev |
|--------|-------|
| **"AI yatırımcı"** | Araç değil, **rol**. Güven yaratır. "Tool" hissi yerine "danışman" hissi. |
| **"Kimsenin söyleyemediği"** | Eşler yalan söyler (destek olsun diye), aile yanlılık yapar, mentor zamansızdır. Boşluk bu. |
| **"Gerçeği söyleyen"** | Brutal honesty = differentiator. Rakipler "analiz" verir, Council **karar** verir. |
| **"Fikrin hakkında"** | Spesifik use case. "Her şey yapan AI" değil, **fikir değerlendirme**. |

### Ana Problemin Yeniden Tanımı

Eski tanım: *"İnsanların fikirlerini değerlendirecek bir AI şirket"*

**Gerçek problem:**
> İnsanlar fikirlerini **değerlendirmek** istemiyor.
> İnsanlar **emin olmak** istiyor.

Bu küçük bir nüans değil — ürünün tüm karakterini değiştirir:

| Eski çerçeve (analysis) | Yeni çerçeve (certainty) |
|------------------------|--------------------------|
| Çıktı: Rapor | Çıktı: Karar |
| Ton: Analyst | Ton: Investor/mentor |
| Değer: Bilgi | Değer: Güven (emin olma) |
| Süre: "Oku ve düşün" | Süre: "10 saniye, bitti" |
| UX: Dashboard | UX: Verdict card |

### Kullanıcının Gerçek Sorusu

Kullanıcı Council'a gelirken şunu sormuyor:
- ❌ *"Bu fikrin SWOT analizini yap"*
- ❌ *"Bana market segmentation ver"*
- ❌ *"Stratejik brief yaz"*

Gerçekte şunu soruyor:
- ✅ *"Bu fikre 6 ay harcasam değer mi?"*
- ✅ *"Bu fikir saçma mı, dürüstçe söyle"*
- ✅ *"İşimi bırakıp bu işe girsem param tükenir mi?"*

**Council bu sorulara cevap vermek için var.**

### v1 ile Fark

| | v1 (mevcut) | v2 (yeni vizyon) |
|---|---|---|
| Ana mesaj | Startup değerlendirme aracı | **"Fikrine dürüst cevap veren AI yatırımcı"** |
| Çıktı | Stratejik Brief (rapor) | **Verdict + 3 sebep + kanıt** |
| Ton | Kurumsal analyst | **Brutal honest mentor** |
| Değer | Analiz | **Certainty (emin olma)** |
| Multi-agent yapı | Görünür (13 ajan) | **Görünmez (arka planda 12 departman)** |
| Dış veri | Yok | **Agent-Reach ile gerçek veri (görünmez, insight olarak sunulur)** |
| Kullanıcı deneyimi | Rapor okuma | **10 saniyede karar** |

---

## BÖLÜM 2: KILLER OUTPUT — "THE VERDICT"

### Ana İçgörü

İnsanlar rapor okumak istemiyor. **Karar** istiyorlar.

```
Killer output = karar
Rapor = supporting material (opsiyonel)
```

### The Verdict Formatı

```
┌────────────────────────────────────────┐
│                                        │
│   "Online terapi platformu"            │
│                                        │
│   ❌  YAPMA                             │
│                                        │
│   1. BetterHelp zaten pazarı kapmış    │
│      → Reddit'te "pahalı" şikayeti     │
│        2.3K upvote                     │
│                                        │
│   2. HIPAA compliance tek başına       │
│      6 aylık bürokrasi                 │
│      → Legal checklist                 │
│                                        │
│   3. Müşteri edinim maliyeti >         │
│      aylık abonelik                    │
│      → Finance hesabı                  │
│                                        │
│   Güven: %87                           │
│                                        │
│   [Ikna etmeye çalış]                  │
│   [Detaylı aç ▼]                       │
│   [Paylaş]                             │
│                                        │
└────────────────────────────────────────┘
```

### 3 Verdict Tipi

```
✅ YAP        → Fikir sağlam, ileri git
⚠️  PIVOT     → Fikir tam doğru değil, şöyle değiştir
❌ YAPMA      → Vakit harcama, başka şey dene
```

Soft cevap yok. "Promising", "risky" gibi belirsizlikler yok. Kullanıcı **net karar** istiyor, Council net karar veriyor.

### 3 Sebep Kuralı

- Her sebep **tek cümle**
- Her sebep bir **kaynağa** bağlı
- Her sebep **aksiyonlanabilir** bilgi
- 3'ten fazla sebep → zayıflık (1-2 güçlü sebep 5 zayıf sebepten daha ikna edici)

### Drill-Down (Opsiyonel)

Verdict ana ekran. Detay isteyen tıklar:
- "Neden böyle düşünüyorsun?" → sources açılır
- "Pazar analizini göster" → Marketing departmanı çıktısı
- "Teknik planı göster" → Engineering departmanı çıktısı
- "Maliyet hesabı" → Finance departmanı çıktısı

**Departmanlar drill-down'da yaşar, ana ekranda değil.**

---

## BÖLÜM 3: TRUST LAYER

### En Büyük Gizli Risk

Kullanıcı ilk kullanımda mutlaka şunu düşünecek:
> *"AI ne bilecek benim fikrimi? Hallüsinasyon yapıyor olabilir."*

Eğer ilk cevap yanlış veya güvenilmez görünürse → **kullanıcı bir daha gelmez**. Bu tek başına ürünü öldürür.

**Trust = Product-Market Fit'in ön koşulu.**

### Trust Layer'ın 5 Bileşeni

#### 1. Confidence Scoring
```
"Bu fikir başarısız olacak (güven: %87)"
```
Düşük güven varsa açıkça söyle:
```
"Burada yeterli veri yok.
 Kararımı %60 güvenle söylüyorum,
 daha çok araştırman gerekebilir."
```

#### 2. Source Attribution (Zorunlu)

Her iddia bir kaynağa bağlı olmak zorunda:

- ❌ *"Bu pazar küçük"*
- ✅ *"Bu pazar küçük — [Reddit r/therapy, 340 thread, son 30 gün]"*

Kullanıcı tıklayınca kanıt açılır. Black box değil.

#### 3. Uncertainty Hedging

AI kendi sınırlarını kabul etmeli:
- *"Bu bir varsayım"*
- *"Bu konuda emin değilim ama"*
- *"Eğer X doğruysa, o zaman Y"*
- *"Burası için daha çok veri lazım"*

İronik şekilde, **"bilmiyorum"** demek güveni ARTIRIR.

#### 4. Anti-Hallucination Guardrails

| Iddia tipi | Kaynak zorunluluğu |
|-----------|---------------------|
| Marketing claim | Agent-Reach verisi zorunlu |
| Finance rakamı | Formül + kaynak zorunlu |
| Legal risk | Checklist + disclaimer zorunlu |
| Verdict | En az 3 independent signal |
| Technical feasibility | Known pattern match |

Kural: **Kaynak yoksa iddia yok.**

#### 5. "Ben yanılmış olabilirim" kültürü

Ürün kendi sınırlarını kabul etmeli. Bu, rakiplerin **yapmadığı** şey.

Tagline olabilir:
> *"Dürüst olmak için bazen 'bilmiyorum' demek gerekir."*

### Neden Trust Layer Kritik?

- Council'ın tek cümlelik promise'ı: **"dürüst cevap"**
- Dürüstlük, **bilmediğini kabul etmek** demek
- Hallüsinasyon → dürüstlük değil → promise'ın kırılması → güven kaybı → kullanıcı kaybı

**Trust layer, ürünün etik omurgası.**

---

## BÖLÜM 4: AGENT-REACH — "GÖRÜNMEZ VERİ"

### Eski Yanlış Yaklaşım

```
"Twitter'da 15K tweet var, Reddit'te 2.3K upvote,
 LinkedIn'de 340 iş ilanı, sentiment %68 pozitif..."
```

Bu **ham veri spam'i**. Kullanıcı okumaz, önemsemez, yorulur.

### Doğru Yaklaşım: Insight, Veri Değil

```
"Bu fikir başarısız. Çünkü Reddit'teki terapi
 topluluğu 'BetterHelp bile pahalı' diyor —
 sen nasıl para kazanacaksın?"
```

Aynı veri, **yorumlanmış gerçeklik** olarak sunuluyor.

### Görünmez Ama Ulaşılabilir

```
"Bu fikir başarısız olacak çünkü [Reddit thread] 
 müşteriler mevcut alternatifleri bile pahalı buluyor."
                    ↑
            tıklanınca kanıt açılır
```

- **Varsayılan görünüm:** Sadece insight
- **Tıklayınca:** Ham veri + kaynak linki
- **Power user için:** "Raw research" sekmesi

### Teknik Değişim

```typescript
// ESKİ: kullanıcıya ham veri göster
interface OldMarketingOutput {
  twitterVolume: number
  redditUpvotes: number
  linkedinJobs: number
  sentiment: number
}

// YENİ: kullanıcıya insight göster, veri arkada
interface NewMarketingOutput {
  verdict: "positive" | "negative" | "mixed"
  oneSentenceInsight: string  // "Kullanıcılar mevcut çözümleri pahalı buluyor"
  evidence: {
    sources: Source[]  // Tıklayınca açılan kanıtlar
    rawData: any      // Drill-down için
  }
}
```

### Agent-Reach'in Yeri

Agent-Reach **ürünün özelliği değil, fuel'ı**. Kullanıcı "Agent-Reach kullanılıyor" bile bilmez. Sadece "Council dürüst konuşuyor, kanıtı var" der.

### Alternatif: Agent-Reach'i pas geç

P12 (Agent-Reach Integration Risk) kritik bir endişe. Python-TypeScript bridge riskli.

**Alternatif sağlayıcılar:**
- **Exa API** — semantic web search, unified, ücretli ama stabil
- **Tavily API** — AI-first search, LLM-friendly output
- **Perplexity API** — arama + özet
- **Serper** — Google search wrapper

**Önerim:** v2.0'da Agent-Reach **olmasın**. Exa veya Tavily ile başla. Agent-Reach v2.2+'a bırak (veya tamamen pas geç).

---

## BÖLÜM 5: 2 FARKLI ÜRÜN → AYIRMA STRATEJİSİ

### Kritik İçgörü

Farkında olmadan 2 farklı ürün tasarlıyordum:

**Ürün A — Idea Validator**
- **Kullanıcı:** Girişimci, indie hacker, non-technical founder
- **Amaç:** "Bu fikir para kazanır mı?"
- **Değer:** Hızlı verdict + kanıt
- **Süre:** 10 saniye
- **Ton:** Brutal honest investor
- **Fiyat:** Ucuz ($9-15/ay)

**Ürün B — Company Simulator**
- **Kullanıcı:** Teknik geliştirici, araştırmacı, eğitim
- **Amaç:** "Multi-agent sistemi nasıl çalışır, izleyeyim"
- **Değer:** Eğlence + öğrenme + deep dive
- **Süre:** 5-10 dakika
- **Ton:** Educational, immersive
- **Fiyat:** Pro ($49/ay)

**Bu ikisini aynı ürün yapmak, ikisini de başarısızlığa sürüklüyor.**

### Çözüm: İsim ve Deneyim Ayrımı

- **Council** — Ürün A (hızlı karar, ana ürün)
- **Council Studio** — Ürün B (simulation, opsiyonel Pro)

Studio, Council'ın bir "modu" değil, **ayrı bir deneyim**. Aynı backend, farklı UX, farklı hedef.

### v2 için Stratejik Sonuç

- **v2.0 → Sadece Ürün A (Idea Validator).** Focus burada.
- **v2.3+ → Studio eklenir.**

Bu ayrım, scope problemini (P3) çözüyor ve product-market fit'i (P20) hızlandırıyor.

---

## BÖLÜM 6: SIMULATION — GROWTH ENGINE, CORE DEĞİL

### Yeniden Konumlandırma

Eski düşünce: *"Simulation core feature"*

Yeni düşünce: *"Simulation growth engine"*

### Simulation'ın Gerçek Değeri

- Kullanıcıyı eğlendirir → **paylaşılabilir content**
- "Council'ın CEO'su benim fikrime 'red' dedi" → **Twitter şakası**
- Video: "AI şirketi benim fikrimi yargılıyor" → **TikTok viral potansiyel**
- "Toplantıyı izle" deneyimi → **demo için ideal**

### Pratik Uygulama

- **Ana ürün (v2.0):** Hızlı brutal verdict (core value)
- **Studio mode (v2.3):** Simulation, Pro tier
- **Her verdict'in altında:** "Toplantıyı izle" butonu → shareable video/image
- **Landing page'de:** Demo simulation video (viral hook)

Simulation, core değil ama **kullanıcı kazanma makinesi**.

---

## BÖLÜM 7: VIRAL MEKANİZMALAR

### En Güçlü Büyüme Hack'i

> *"AI bana fikrimin çöp olduğunu söyledi"*

Bu cümle **doğal olarak paylaşılır**. İnsanlar kendileriyle ilgili acı gerçekleri paylaşmayı sever (ironi + dürüstlük).

### 7 Viral Mekanizma

#### 1. Shareable Verdict Card
Her verdict bir görsel kart olarak paylaşılabilir:
```
┌───────────────────────────────┐
│  COUNCIL VERDICT              │
│                               │
│  "Podcast uygulaması"         │
│                               │
│  ❌ YAPMA                      │
│                               │
│  Sebebi: Spotify zaten        │
│  ücretsiz.                    │
│                               │
│  council.dev/v/abc123         │
└───────────────────────────────┘
```
Twitter kartı, Instagram post, Reddit share — hepsi için hazır.

#### 2. Roast Mode
Toggle: *"Sert konuş"* → daha acımasız cevap
- Normal: *"Bu fikir zorlu olabilir"*
- Roast: *"Bunu yapma. Kimse umursamıyor."*

Paylaşılabilirliği artırır.

#### 3. Public Ideas Feed (Opsiyonel)
*"Bugün en sert eleştirilen fikirler"*
- Entertainment
- Social proof
- SEO trafik

#### 4. "Council'ı ikna et" Modu
Kullanıcı hayır cevabını kabul etmiyor mu? İkna etmeye çalışsın. Conversation loop → engagement + retention.

#### 5. Challenges
*"Fikrimi Council'a sor"* — social media challenge. Viral potansiyel + zero cost marketing.

#### 6. Verdict URL'leri
Her verdict kalıcı URL ile paylaşılır: `council.dev/v/abc123`. Backlink + SEO + viral loop.

#### 7. Arkadaş Karşılaştırma
*"Benim fikrim arkadaşımınkinden daha iyi/kötü"* — sosyal karşılaştırma mekanizması.

### Neden Bu Mekanizmalar Önemli?

Sıfır pazarlama bütçesiyle başlıyoruz. **Viral = organik büyüme = düşük CAC**. Ürünün kendisi marketing olmalı.

---

## BÖLÜM 8: RETENTION STRATEJİSİ

### Yanlış Soru

*"Kullanıcı neden geri gelsin?"* — zorlama retention düşüncesi.

### Doğru Soru

*"Kullanıcının doğal geliş sebebi ne?"* — ürün-kullanıcı uyumu.

### Retention Mekanizmaları

#### 1. Fikir Günlüğü
Kullanıcının fikirleri saklanır. Zaman içinde ilerleme:
```
6 ay önce: Fikir #1 (YAPMA - pazar kötü)
    ↓ pivot
3 ay önce: Fikir #2 (PIVOT - müşteri yanlış)
    ↓ pivot
Bugün:     Fikir #3 (YAP - doğru yol)
```

#### 2. Pazar Güncellemeleri
30 gün sonra otomatik:
> *"Reddit'teki sentiment değişti. Fikrinin durumu farklılaşmış olabilir. Tekrar değerlendir?"*

Pasif email, aktif dönüş nedeni.

#### 3. Rakip Uyarısı
> *"Benzer bir fikir Y Combinator'da çıktı. Rakip analizi gözden geçir."*

Kullanıcı kendi pazarında ne olduğunu bilmek ister.

#### 4. Fikir Karşılaştırma
*"Bu fikrim önceki fikrimden daha iyi mi?"* → head-to-head comparison.

#### 5. Pivot Önerileri
Red verilen fikirler için: *"Şu şekilde değiştirirsen evet derim"* → pivot önerisi.

### "AI Sana Fikir Önerir" Riski

Kullanıcının önerdiği mekanizma ("AI fikir önerir") tehlikeli olabilir çünkü:
- Council "fikir jeneratörü" olur, "değerlendirici" değil
- "Brutal truth" pozisyonu sarsılır: dürüst adam fikir satmaz

**Daha güvenli yaklaşım:** Pivot önerisi (kullanıcının fikri üzerinden) evet, **boşluktan fikir yaratmak** hayır.

---

## BÖLÜM 9: OUTPUT QUALITY — MVP'NİN ASIL MERKEZİ

### Kabul

Doküman şimdiye kadar %60 mimari, %20 maliyet, %10 UX, %10 çıktı kalitesi oran dağılımı ile yazılmıştı. **Bu yanlış.**

### Gerçek MVP Sorusu

> *"Council tek bir fikri alıp, dürüst, doğru, güvenilir bir verdict verebiliyor mu?"*

Bu çalışmadan diğer her şey boş. Mimari, caching, multi-agent, prompt caching — hepsi **gereksiz** eğer çıktı kalitesi düşükse.

### Düzeltilmiş MVP Önceliği

| Alan | Efor | Neden |
|------|------|-------|
| **Output quality** | %50 | Her şeyin temeli |
| **Trust layer** | %20 | Promise'ın teslimi |
| **Core UX** | %15 | 10 saniyede sonuç |
| **Architecture** | %10 | Yeterli, optimize etmeden başla |
| **Her şey diğer** | %5 | Sonra |

### Output Quality Nasıl Sağlanır?

#### 1. Golden Examples Set
- 50 örnek fikir
- Her biri için ideal verdict + sebepler (elle yazılmış)
- Her prompt değişikliğinde bu set'e karşı test

#### 2. Prompt Engineering
- CEO system prompt'u **vizyon cümlesiyle tutarlı** olmalı
- "AI investor" tonu prompt'ta sabit
- Verdict formatı sabit (always verdict + 3 reasons + confidence)

#### 3. Test-First Yaklaşım
- Her değişiklikten sonra golden set ile karşılaştır
- Regression var mı?
- Subjective quality score (1-10) takibi

#### 4. Iterative Prompt Refinement
- Haftalık prompt review
- Kullanıcı feedback'i → prompt güncelleme
- A/B test farklı system prompt versiyonları

### Quality > Architecture

> "Kötü output + iyi mimari = çöp
>  İyi output + kötü mimari = ürün"

v2.0'da bunu unutma. Önce çıktıyı doğrula, sonra optimize et.

---

## BÖLÜM 10: COMPETITIVE LANDSCAPE — YENİ GÖZDEN GEÇİRME

### Gerçek Rakip Kim?

Eski liste: Cursor, Bolt, Lovable, Devin, MetaGPT, ChatDev...

**Ama bunlar Council'ın rakibi değil.** Hepsi "kod yaz" kategorisinde. Council kod yazmıyor, **karar veriyor**.

### Council'ın Gerçek Rakipleri

| Rakip | Nasıl çözüyor? | Council nasıl farklı? |
|-------|-----------------|-----------------------|
| **Eş/Aile tavsiyesi** | Destekleyici, yanlı | Dürüst, objektif |
| **Mentor** | Zamanı yok, pahalı, yavaş | Her zaman uygun, ucuz, hızlı |
| **Co-founder konuşması** | Sadece co-founder varsa | Solo founders için de |
| **Reddit/Indie Hackers** | Dağınık, trol'lü | Yoğun, yapılandırılmış |
| **Düşünerek beklemek** | Paralysis by analysis | 10 saniyede karar |
| **Tavsiye kitapları** | Generic, spesifik değil | Senin fikrine özel |
| **AI evaluation tools** | Yavaş, rapor bazlı, güvensiz | Hızlı, verdict bazlı, kanıtlı |

### Yeni Pozisyon

Council **tavsiye pazarının** AI alternatifi, code generation pazarının değil.

> *"Eski dünya: fikrini eşine anlatırsın, yalan söyler.*
> *Yeni dünya: Council'a anlatırsın, dürüstçe söyler."*

### Why Now?

- LLM'ler artık yeterince güvenilir (hallüsinasyon yönetilebilir)
- Multi-agent pattern'lar olgun (Claude Code, MetaGPT)
- AI coding tools doyma noktasında, planning tools boş
- Indie hacker/solo founder pazarı büyüyor (no-code dalgasıyla)
- İnsanlar AI'dan bilgi almaya alışkın (ChatGPT effect)

---

## BÖLÜM 11: MONETİZASYON (REVİZE)

### 2026 Trendi

Hybrid pricing 2026 standardı (%61 SaaS, %85 AI lider).

### Council v2 Model

**Not:** Fiyat rakamları TBD. PMF'den sonra kesinleşir.

```
┌─────────────────────────────────────────────┐
│  FREE (Acquisition)                         │
│  - 3 verdict/ay                             │
│  - Basic confidence score                   │
│  - Verdict card paylaşımı                   │
│  - "Powered by Council" branding            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  PRO (Ana Hedef)                            │
│  - Sınırsız verdict                         │
│  - Agent-Reach / Exa entegrasyonu           │
│  - Detaylı drill-down                       │
│  - Roast mode                               │
│  - Fikir günlüğü + pazar güncellemeleri     │
│  - Rakip uyarıları                          │
│  - PDF export                               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  STUDIO (Power User / Pro Tier)             │
│  - Her şey Pro'da                           │
│  - Simulation mode (şirketi izle)           │
│  - Board meeting view                       │
│  - Custom departmanlar                      │
│  - Team collaboration                       │
│  - API access                               │
└─────────────────────────────────────────────┘
```

### Retention Features → Pro'da

Bölüm 8'deki retention mekanizmaları (fikir günlüğü, pazar güncellemeleri, rakip uyarıları) **Pro tier'a özel**. Bu, Free → Pro geçişinin motoru.

### Pricing Stratejisi

- **Free:** Geniş funnel
- **Pro:** Impulse buy bölgesinde ($9-19 range)
- **Studio:** Power user tier ($39-59 range)

**Fiyat belirleme:** İlk 100 kullanıcı free, sonra fiyat A/B test.

---

## BÖLÜM 12: KULLANICI DENEYİMİ (BASITLEŞTIRILDI)

### Eski UX (Karmaşık)
- 5 mod
- 12 departman
- 4 segment
- 3 output formatı

### Yeni UX (Tek Akış)

```
Landing → Input → Loading (5-10 sn) → Verdict → [Derinleş ▼]
```

**O kadar.** Mod seçici yok, segment seçici yok, karmaşıklık yok.

### Tek Varsayılan Akış

#### 1. Landing
- 1 cümle promise: *"Fikrine dürüst cevap veren AI yatırımcı"*
- 1 demo video (15 sn)
- Input box (büyük, ortada)

#### 2. Input
```
┌────────────────────────────────────────┐
│                                        │
│  Fikrin nedir?                         │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Online terapi platformu        │    │
│  │ yapmak istiyorum...            │    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
│         [Dürüst cevap al →]            │
│                                        │
└────────────────────────────────────────┘
```

#### 3. Loading (Hikaye ile)
```
⏳ Verdict hazırlanıyor...

   ✓ Fikir anlaşıldı
   ✓ Pazar taranıyor
   ○ Sebepler derleniyor
```
Kullanıcı ne olduğunu görür → beklemeye razı olur.

#### 4. Verdict
Bölüm 2'deki Verdict format'ı. Ana sayfa bu.

#### 5. Derinleş (Opsiyonel)
- Detaylı sebepler
- Kaynaklar
- Alternatif öneriler ("Pivot öneri")
- Departman raporları (power user için)

### Adaptive Complexity

Sistem otomatik karar verir:
- Basit fikir → 3 departman çalışır, hızlı verdict
- Karmaşık fikir → 8+ departman çalışır, detaylı verdict
- Enterprise fikir → Full 12 departman, deep analysis

**Kullanıcı farkında olmaz.** Backend sırrı.

### Power User Path

Drill-down ile her şeyi görebilir:
- "Görüntü: Verdict" (varsayılan)
- "Görüntü: Departman raporları"
- "Görüntü: Ham veri"
- "Görüntü: Source timeline"

Varsayılan basit, power user için derinlik var.

---

## BÖLÜM 13: v1'İN DURUMU (TEKNİK BACKGROUND)

### Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **AI:** @anthropic-ai/sdk + @ai-sdk/anthropic
- **Database:** Supabase (PostgreSQL)
- **UI:** TailwindCSS 4 + shadcn/ui
- **Validation:** Zod 4

### Mevcut 13 Ajan (v1)

strategist, architect, designer, backend_engineer, frontend_engineer, devops, devops_deploy, qa_writer, security, legal, marketing, product_manager, support_docs, triage

### v1'in 6 Fazlı Pipeline'ı

```
Phase 1: Strategic Intake (strategist)
Phase 2: Product Definition (product_manager + legal)
Phase 3: Architecture & Design (architect + designer + security_threat)
Phase 4: Implementation — ⚠️ PLACEHOLDER
Phase 5: Verification & Hardening — ⚠️ PLACEHOLDER
Phase 6: Release & Operate (devops_deploy + marketing + support_docs)
```

### v1'deki Eksikler

- ❌ Phase 4-5 tool agents `return null`
- ❌ Ajanlar arası iletişim yok
- ❌ Departman yapısı yok
- ❌ Gerçek dış dünya erişimi yok
- ❌ Hafıza yok
- ❌ Hiyerarşi yok
- ❌ Bütçe yönetimi basit
- ❌ Dinamik ölçekleme yok

**Not:** v2'de bunların çoğu **core problem değil** — output quality önce gelir. v2.0'da sadece "tek fikir → tek verdict" çalışsın yeter.

---

## BÖLÜM 14: MİMARİ — "COMPANY BRAIN" (TEKNİK ALTYAPI)

### Felsefe

Mimari **kullanıcıya görünmez**. Backend sırrı.

Ama iyi mimari = düşük maliyet + yüksek hız → **sürdürülebilirlik**.

### Ana Fikir: Tek API Call ile Çok Departman

**v1 sorunu:**
```
Her ajan = ayrı API call
10 call = ~$0.25/request
```

**v2 çözümü:**
Departmanları tool olarak tanımla, tek API session içinde LLM hangi departmanı aktive edeceğine karar versin.

```typescript
const companyTools = [
  {
    name: "market_research",
    description: "Gerçek pazar verisi getirir (Agent-Reach/Exa)",
    input_schema: { keywords: string[] }
  },
  {
    name: "legal_check",
    description: "Compliance ve yasal risk analizi",
    input_schema: { domain: string }
  },
  // ... diğerleri
]
```

### 3 Kademeli Mimari

```
┌─────────────────────────────────────────────┐
│  KADEME 1: LOCAL ORCHESTRATOR (0 API call)  │
│  - Triage (deterministic)                   │
│  - Context management                       │
│  - Agent-Reach/Exa calls                    │
│  - Template-based deps (Legal, Finance)     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  KADEME 2: TOOL-USE LOOP (1-2 API call)     │
│  - LLM CEO rolünde                           │
│  - Departman tool çağırır                    │
│  - Parallel execution                        │
│  - Streaming response                        │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  KADEME 3: ESCALATION (nadir, 1 API call)   │
│  - Karmaşık durumlar için Opus               │
└─────────────────────────────────────────────┘
```

### Local vs LLM Boundary

**LOCAL (0 API call) — template/rule-based:**
- Finance (hesaplama, deterministik)
- Legal (compliance checklist)
- QA (test template)
- DevOps (infra template)
- Triage (keyword routing)

**LLM GEREKLİ — yaratıcılık lazım:**
- CEO (strateji, karar sentezi)
- Architect (yaratıcı tasarım)
- Product Manager (kullanıcı analizi)
- Designer (yaratıcı UX)
- Marketing (içerik + insight üretimi)

**Karar kriteri:**
```
Deterministik + template mümkün? → LOCAL
Yaratıcılık + context-dependent? → LLM
Template + subjective enhancement? → HYBRID (template first, LLM optional)
```

### Non-Determinism Sorunu (P10)

**Sorun:** LLM "hangi departmanı çağıralım" deterministik değil.

**Çözüm:** İki katmanlı karar:
1. **Triage katmanı deterministik:** `project_type → required_departments` map (hard-coded)
2. **LLM departman İÇİNDEKİ kararı alır:** ne yazacağı, nasıl yorumlayacağı

Aynı input → aynı departman listesi → aynı sonuç (neredeyse).

### Maliyet

```
v1 (her ajan ayrı call): ~$0.25/request
v2 Company Brain:        ~$0.03-0.05/request

Tasarruf: 5-8x
```

---

## BÖLÜM 15: MALİYET OPTİMİZASYONU (CLAUDE CODE'DAN)

### 9 Teknik

#### 1. Prompt Caching (%60-90 tasarruf)
```typescript
system: [{
  type: "text",
  text: systemPrompt,
  cache_control: { type: "ephemeral" }
}]
```

#### 2. Model Tiering
```
Haiku ($1/$5):     Triage, sınıflandırma
Sonnet ($3/$15):   Çoğu iş
Opus ($15/$75):    CEO, Architect, kritik
```

#### 3. Deferred Tools (%10-30 tasarruf)
Her departman kendi tool setini görür.

#### 4. Context Compaction (%70-85 faz arası)
Eski çıktılar özet olarak sonraki faza geçer.

#### 5. Output Token Capping (%50-70 output)
```
Triage: 2K | Legal/QA: 4K | Engineer: 8K | CEO: 16K
```

#### 6. Parallel Execution
Bağımsız tool'lar `Promise.all` ile paralel.

#### 7. File State Cache (LRU)
Aynı veriyi tekrar okuma.

#### 8. Smart Escalation
Haiku → Sonnet → Opus cascade.

#### 9. Prefetch & Speculation
Kullanıcı yazarken arka planda hazırlık.

**Toplam etki:** Aynı kalitede 5-10x ucuz.

---

## BÖLÜM 16: HATA YÖNETİMİ (CLAUDE CODE'DAN 17 PATTERN)

### Kritik Pattern'lar

| Pattern | Kullanım |
|---------|----------|
| Exponential backoff + jitter | Tüm API retry |
| 429 tier-aware retry | Rate limit |
| 529 overload → fallback model | Overload cascade |
| Token overflow → reduce + retry | Context limit |
| Stream 404 → non-streaming | Stream interrupt |
| Stale connection → fresh client | Network |
| Tool failure → telemetry-safe error | Agent crash |
| Compaction fail → original messages | Compact error |
| Model fallback (Opus → Sonnet → Haiku) | Persistent fail |

### Council v2 Resilience Katmanı

```
src/lib/resilience/
├── withRetry.ts          # Claude Code pattern
├── errorClassifier.ts    # Telemetry-safe
├── fallbackCascade.ts    # Model degradation
├── compactRecovery.ts    # Compaction fallback
└── searchFallback.ts     # Exa/Agent-Reach timeout → cached
```

### Trust Layer ile Bağlantı

Hata durumunda kullanıcıya **dürüst ol**:
> *"Bu fikir için tam veri alamadım. Güvenim %50. Daha kesin cevap için tekrar dene."*

Hata → hallüsinasyon değil, hata → dürüstlük.

---

## BÖLÜM 17: DEPARTMAN YAPISI (BACKEND SIRRI)

### Not

Bu bölüm eskiden "core vizyon"du. Artık **teknik arka plan**.

Kullanıcı departmanları görmez. Sadece verdict'i görür. Departmanlar **insight üretim motoru**.

### 12 Departman (Backend)

```
C-SUITE (Karar)
├── CEO Office      — Verdict sentezi
├── CTO Office      — Teknik fizibilite
└── CPO Office      — Ürün/kullanıcı analizi

CORE (Üretim)
├── Engineering     — Tech feasibility + stack
├── Design          — UX/UI kritik noktalar
└── Data & Analytics — Pazar verisi işleme

BUSINESS (Pazar)
├── Marketing       — Pazar araştırma (Agent-Reach/Exa)
├── Sales & BD      — Go-to-market
└── Customer Success — Retention/adoption

SUPPORT (Risk)
├── Legal & Compliance — Risk checklist
├── Finance         — Maliyet/gelir modeli
└── HR / People     — Operasyonel risk
```

### Adaptive Selection

Triage karar verir:
- Basit fikir (blog) → 3 departman
- Orta fikir (SaaS) → 6 departman
- Karmaşık fikir (fintech) → 10 departman
- Enterprise → 12 departman

Kullanıcı fark etmez, backend otomatik.

### UI'da Yeri

Ana ekranda: **yok**. Verdict + 3 sebep var.

Drill-down'da: **var**. "Detaylı raporlar" sekmesi altında power user için.

---

## BÖLÜM 18: MODEL SEÇİMİ

| Model | Fiyat | Kullanım |
|-------|-------|----------|
| Claude Haiku 4.5 | $1/$5 | Triage, routing, fallback |
| Claude Sonnet 4.6 | $3/$15 | Çoğu departman, ana iş |
| Claude Opus 4.6 | $15/$75 | CEO (verdict), kritik kararlar |
| DeepSeek V3 | $0.27/$1.1 | Opsiyonel fallback, code-heavy |

**Önerilen mix (v2.0):**
- CEO + Architect: Opus (kalite kritik)
- Çoğu departman: Sonnet (denge)
- Triage: Haiku (ucuz)

Multi-provider gerekli değil — Claude ecosystem içinde kal.

---

## BÖLÜM 19: v2 ROADMAP (YENİ ÖNCELİKLENDİRME)

### v2.0 — "Dürüst Verdict" (Core MVP)

**Amaç:** Tek bir fikri alıp, dürüst, güvenilir bir verdict ver.

**Scope:**
- v1 Phase 4-5 fix (sadece gerekirse — verdict için şart değil)
- Company Brain mimarisi (basit, tek API session)
- Prompt caching (temel)
- Model tiering (Opus + Sonnet + Haiku)
- **Output quality** (golden examples + test set)
- **Trust layer** (confidence, sources, guardrails)
- **Core UX** (input → verdict → drill-down)
- 3 aktif departman: CEO + Market Research + Finance
- Verdict card (shareable)

**Scope dışı:**
- Agent-Reach (v2.1'e)
- Full 12 departman (v2.2'ye)
- Simulation (v2.3'e)
- Monetizasyon (v2.1'e)
- Retention features (v2.1'e)

### v2.1 — "Real Data + Retention"

- Exa/Tavily entegrasyonu (Agent-Reach alternative)
- Marketing departmanı → gerçek veri
- 6 departman aktif
- Fikir günlüğü
- Pazar güncellemeleri (email)
- Rakip uyarıları
- Free/Pro tier'lar

### v2.2 — "Full Company"

- 12 departman aktif
- Adaptive department selection
- Inter-department memo sistemi
- Local tool ecosystem (Eta + json-rules-engine)
- Output-driven UI

### v2.3 — "Studio Mode"

- Simulation mode (şirketi izle)
- Board meeting view
- Viral sharing features
- Roast mode
- Public ideas feed

### v2.4 — "Scale & Intelligence"

- Şirket hafızası (önceki projelerden öğrenme)
- Custom department creation
- Team collaboration
- API access

---

## BÖLÜM 20: 27 PROBLEME CEVAPLAR

Dış bir inceleme ile tespit edilen 27 problem ve çözümler:

### CORE PRODUCT PROBLEMS

**P1 — Undefined Core Value Proposition** → **ÇÖZÜLDÜ**
Yeni promise: *"Fikrin hakkında kimsenin söyleyemediği gerçeği söyleyen AI yatırımcı"*

**P2 — Lack of Single Killer Output** → **ÇÖZÜLDÜ**
Verdict + 3 sebep (Bölüm 2)

**P3 — Over-scoped Product Vision** → **KISMEN ÇÖZÜLDÜ**
v2.0 scope'u küçüldü: sadece Idea Validator (Ürün A). Studio v2.3'e.

**P4 — Weak First Use Case** → **ÇÖZÜLDÜ**
Landing'de demo video + tek fikir örneği

**P5 — No Clear 'Why Now'** → **ÇÖZÜLDÜ**
Bölüm 10'da cevaplandı

### UX PROBLEMS

**P6 — Overcomplex UX** → **ÇÖZÜLDÜ**
Tek akış: input → verdict → drill-down. Mod yok, segment yok.

**P7 — Simulation Over Value** → **ÇÖZÜLDÜ**
Simulation artık core değil, growth engine (Studio mode)

**P8 — Lack of Simplicity** → **ÇÖZÜLDÜ**
UX basitleştirildi (Bölüm 12)

**P9 — No Clear User Journey** → **ÇÖZÜLDÜ**
Canonical flow: Landing → Input → Loading → Verdict → Derinleş

### TECHNICAL PROBLEMS

**P10 — Non-deterministic Tool Orchestration** → **ÇÖZÜLDÜ**
Triage deterministic, LLM sadece internal reasoning

**P11 — Debugging Complexity** → **İLERİ VERSİYONDA**
Structured trace ID + replay mechanism → v2.2

**P12 — Agent-Reach Integration Risk** → **ÇÖZÜLDÜ**
v2.0'da Agent-Reach yok. Exa/Tavily ile başla.

**P13 — External Data Reliability** → **ÇÖZÜLDÜ**
Unified search API (Exa/Tavily) — stabil provider

**P14 — Latency Risk** → **KISMEN**
Streaming UX + optimistic loading + max 30sn budget

**P15 — Missing Caching Layer** → **PLANLANDI**
4 katmanlı cache: LLM native, market data (Redis), template, full brief

**P16 — Context Explosion** → **ÇÖZÜLDÜ**
Aggressive compaction per phase

### ARCHITECTURE PROBLEMS

**P17 — Unclear Local vs LLM Boundary** → **ÇÖZÜLDÜ**
Bölüm 14'te net kriter

**P18 — Tool Over-Abstraction** → **KISMEN**
Compute functions (local) vs Reasoning tools (LLM) ayrımı

**P19 — Scaling Complexity** → **ERTELENDİ**
100 kullanıcıdan sonra endişelen

### PRODUCT STRATEGY PROBLEMS

**P20 — Unfocused Target Audience** → **ÇÖZÜLDÜ**
Beachhead: indie hacker / non-technical founder

**P21 — Premature Monetization** → **ÇÖZÜLDÜ**
Model var, fiyat TBD (PMF sonrası)

**P22 — No Retention Strategy** → **ÇÖZÜLDÜ**
Bölüm 8'de 5 mekanizma

**P23 — No Data Moat Strategy** → **İLERİ VERSİYONDA**
Aggregate insights → v2.4+

**P24 — No Feedback Loop** → **PLANLANDI**
1-tık rating + per-section feedback + prompt optimization

### EXECUTION RISKS

**P25 — Solo Development Risk** → **KABUL**
Claude ile yapılabilir, sprint bazlı çalış

**P26 — Phase 4-5 Incomplete** → **DEĞERLENDİRİLDİ**
Verdict için şart değil, opsiyonel v2.0

**P27 — Feature Creep Risk** → **ÇÖZÜLDÜ**
v2.0 frozen scope: 9 madde, ek yok

---

## BÖLÜM 21: KARAR VERİLMESİ GEREKENLER

| # | Karar | Önerim | Status |
|---|-------|--------|--------|
| 1 | Value proposition | "AI investor, dürüst cevap" | ⏳ onay |
| 2 | Killer output | Verdict + 3 sebep (not rapor) | ⏳ onay |
| 3 | Simulation'ın yeri | Growth engine / Studio mode | ⏳ onay |
| 4 | Agent-Reach yaklaşımı | v2.0'da yok, Exa kullan | ⏳ onay |
| 5 | 2 ürün ayrımı | Council + Council Studio | ⏳ onay |
| 6 | Target audience | Indie hacker / non-tech founder | ⏳ onay |
| 7 | Tone | Brutal honest investor | ⏳ onay |
| 8 | MVP priority | Output quality > architecture | ⏳ onay |
| 9 | Trust layer | Mandatory, 5 bileşen | ⏳ onay |
| 10 | v2.0 scope | 9 madde, frozen | ⏳ onay |

---

## BÖLÜM 22: META-SONUÇ

### Eski Doküman Ne Diyordu?

*"Council bir sanal yazılım şirketi — 12 departmanı, 28 rolü, 5 modu var."*

Bu **mühendis gözüyle** yazılmış bir vizyon. Nasıl çalıştığını anlatıyor. Ama **neden kimse umursar?** sorusuna cevap vermiyor.

### Yeni Doküman Ne Diyor?

*"Council fikrin hakkında kimsenin söyleyemediği gerçeği söyleyen bir AI yatırımcıdır."*

Bu **kullanıcı gözüyle** yazılmış bir vizyon. Neden umursaması gerektiğini söylüyor. Nasıl çalıştığı **backend sırrı**.

### Asıl Ders

Önceki dokümanda eksik olan:
- ❌ Psikoloji
- ❌ Kullanıcı davranışı
- ❌ Duygusal trigger
- ❌ Trust
- ❌ Viral mekanizmalar
- ❌ Retention doğası

Yeni dokümanda var:
- ✅ "Emin olmak" = gerçek ihtiyaç
- ✅ Karar = killer output (rapor değil)
- ✅ Tone = investor (analyst değil)
- ✅ Trust layer = ürünün etik omurgası
- ✅ Viral mekanizmalar = growth engine
- ✅ Retention = doğal geliş sebebi

### Tek Cümle

> **Council bir "AI company simulator" değil, bir "AI decision engine" — dürüst kararlar verir.**

### Sonraki Adımlar

1. **10 kararı onayla** (Bölüm 21)
2. **v2.0 minimal scope ile başla:** sadece "tek fikir → dürüst verdict"
3. **Output quality'ye odaklan:** golden examples + prompt engineering
4. **Trust layer'ı build et:** confidence + sources + guardrails
5. **Core UX build et:** input → verdict → drill-down
6. **İlk 50 kullanıcıyla test et**
7. **v2.1'e geç:** Exa, retention, Pro tier

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

**AI Code Builders:**
- [Cursor vs Bolt vs Lovable 2026](https://lovable.dev/guides/cursor-vs-bolt-vs-lovable-comparison)
- [AI App Builder Pricing 2026](https://getmocha.com/blog/best-ai-app-builder-2026/)
- [Devin 2.0 Pricing](https://venturebeat.com/programming-development/devin-2-0-is-here-cognition-slashes-price-of-ai-software-engineer-to-20-per-month-from-500)

**AI Monetization:**
- [2026 AI Agent Pricing Playbook - Chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)
- [2026 Guide to AI Pricing - Monetizely](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models)

**Local Tools:**
- [json-rules-engine](https://github.com/CacheControl/json-rules-engine)
- [Hygen Code Generator](https://github.com/jondot/hygen)

---

*Bu doküman bir canlı dokümandır. Beyin fırtınası ilerledikçe güncellenebilir.*
*Son büyük revizyon: 2026-04-06 (Ürün psikolojisi perspektifi)*
