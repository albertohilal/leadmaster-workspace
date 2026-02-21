# Phase 4 - Commercial Intelligence & Prospect Scoring

## Status: 📋 PLANNED (Not Started)

**Planned Start Date:** TBD  
**Estimated Duration:** 3-4 days  
**Branch:** feature/commercial-intelligence-scoring  
**Depends On:** ✅ Phase 2 (Completed) | 📋 Phase 3 (Planned)

---

## Executive Summary

Phase 4 transforms LeadMaster from a WhatsApp message sender into an intelligent commercial opportunity generator. This phase implements a multi-dimensional scoring system that validates, qualifies, and prioritizes prospects before any commercial action is taken.

**Core Principle:** Not every contact is a qualified prospect. We must score contactability, digital maturity, and commercial potential before investing resources in outreach.

**Business Impact:**
- **Reduces wasted effort:** Only contact prospects with score_contactabilidad >= 70
- **Improves conversion rates:** Prioritize high-potential prospects
- **Enables data-driven decisions:** Transform intuition into measurable scoring dimensions
- **Protects brand reputation:** Avoid contacting technically unvalidated prospects

**Architecture Strategy:**
- **Non-invasive:** Extends Dolibarr data model without modifying core tables
- **Modular:** Scoring engine can evolve independently
- **Integration-ready:** Sender module consumes scoring results
- **Auditable:** All scoring events timestamped and logged

This phase represents the transition from **tactical messaging** to **strategic commercial intelligence**.

---

## Objectives

### Primary Goals

1. **Extend Database Schema**
   - Add scoring fields to `ll_societe_extended` without touching Dolibarr core
   - Create migration-safe SQL scripts
   - Maintain referential integrity with `llxbx_societe`

2. **Define Scoring Dimensions**
   - `score_contactabilidad`: Technical reachability and response probability (0-100)
   - `score_madurez_digital`: Digital presence maturity (0-100)
   - `score_potencial`: Commercial opportunity potential (0-100)
   - `score_total`: Weighted composite score (0-100)
   - `nivel_calidad`: 'A', 'B', 'C', 'D' classification
   - `validado_tecnicamente`: Boolean technical validation flag
   - `validado_comercialmente`: Boolean commercial validation flag
   - `fecha_scoring`: Timestamp for scoring freshness

3. **Establish Integration Rules**
   - Sender module MUST verify scoring before sending
   - Block sending if `score_contactabilidad < 70`
   - Block sending if `validado_tecnicamente = 0`
   - Recommend prospects based on `score_potencial`

4. **Document Scoring Formulas**
   - Provide transparent, auditable scoring logic
   - Define data sources for each dimension
   - Establish calibration methodology

### Secondary Goals

- Create scoring calculation service stub
- Define API contracts for scoring operations
- Establish data quality monitoring strategy
- Document scoring evolution roadmap

---

## Architecture Placement

### Current Architecture (Phase 2)

```
Frontend (React + Vite)
    ↓ HTTPS (Nginx + Cloudflare SSL)
Nginx Reverse Proxy
    ↓ HTTP (localhost:3012)
Central Hub (Express.js) - Modular Monolith
    ├── auth ✅ (JWT authentication)
    ├── session-manager (WhatsApp session lifecycle)
    ├── sender (Mass messaging - Phase 4 pending)
    ├── listener (Auto-responses - Phase 4 pending)
    └── sync-contacts (Gmail integration)
         ↓
    MySQL Database (iunaorg_dyd)
         ├── llxbx_* (Dolibarr core tables)
         └── ll_* (LeadMaster custom tables)
```

### Phase 4 Architecture Extension

```
Central Hub (Express.js)
    ├── auth ✅
    ├── session-manager ✅
    ├── scoring (NEW MODULE) 🆕
    │    ├── scoringController.js
    │    ├── scoringService.js
    │    ├── scoringFormulas.js
    │    └── scoringMiddleware.js
    ├── sender (ENHANCED) ⚡
    │    └── Integration: scoringMiddleware required
    └── listener (ENHANCED) ⚡
         └── Integration: Update scores on interactions

Database Extension:
    llxbx_societe (Dolibarr core - READ ONLY)
         ├── rowid (PK)
         ├── nom (company name)
         ├── email
         ├── phone
         └── ... (Dolibarr fields)
              ↓ 1:1 relationship
    ll_societe_extended (LeadMaster extension - READ/WRITE)
         ├── societe_id (FK → llxbx_societe.rowid)
         ├── score_contactabilidad (NEW) 🆕
         ├── score_madurez_digital (NEW) 🆕
         ├── score_potencial (NEW) 🆕
         ├── score_total (NEW) 🆕
         ├── nivel_calidad (NEW) 🆕
         ├── validado_tecnicamente (NEW) 🆕
         ├── validado_comercialmente (NEW) 🆕
         ├── fecha_scoring (NEW) 🆕
         └── ... (existing ll_ fields)
```

### Module Relationships

```
scoringService
    ↓ (queries)
Database (llxbx_societe + ll_societe_extended)
    ↑ (prospect data)
    ↓ (scoring results)
senderService
    ↓ (validates scores before sending)
scoringMiddleware.validateSendingEligibility()
    → Allow/Block sending decision
```

---

## Database Extension Strategy

### Design Principles

1. **Never Modify Dolibarr Core**
   - `llxbx_societe` remains untouched
   - All extensions go to `ll_societe_extended`
   - Foreign key ensures referential integrity

2. **Nullable by Default**
   - New fields allow NULL (backward compatible)
   - `DEFAULT NULL` permits gradual scoring rollout
   - No disruption to existing data

3. **Type Safety**
   - Scores: `TINYINT` (0-100 constraint via application logic)
   - Booleans: `TINYINT(1)` with 0/1 values
   - Timestamps: `DATETIME` with NULL for unscored prospects
   - Classification: `ENUM` with explicit values

4. **Indexing Strategy**
   - Index `societe_id` (FK lookup)
   - Index `score_total` (sorting qualified prospects)
   - Index `validado_tecnicamente` (filtering)
   - Composite index `(validado_tecnicamente, score_contactabilidad)` for sender queries

5. **Migration Safety**
   - Check column existence before adding
   - Use `IF NOT EXISTS` patterns
   - Provide rollback script
   - Test on staging data first

---

## Scoring Dimensions

### 1. score_contactabilidad (0-100)

**Definition:** Probability that the prospect can be successfully contacted via WhatsApp and will respond.

**Data Sources:**
- Phone number format validation (E.164)
- WhatsApp number validation (via API check)
- Previous WhatsApp interaction history
- Phone number type (mobile vs landline)
- Carrier information (if available)

**Scoring Factors:**

| Factor | Weight | Score Contribution |
|--------|--------|-------------------|
| Valid mobile format | 30% | 0 or 30 |
| WhatsApp number verified | 40% | 0 or 40 |
| Previous WhatsApp interaction | 20% | 0-20 (recency-based) |
| Contact data freshness | 10% | 0-10 (age-based decay) |

**Formula (v1.0):**
```javascript
score_contactabilidad = (
    (is_valid_mobile ? 30 : 0) +
    (whatsapp_verified ? 40 : 0) +
    (previous_interaction_score * 20) +  // 0-1 scale
    (freshness_score * 10)                // 0-1 scale
)

where:
    previous_interaction_score = days_since_last_interaction < 90 ? 1 : 0.5
    freshness_score = 1 - (days_since_data_update / 365)
```

**Business Rules:**
- Score < 30: Critical data quality issues (missing/invalid phone)
- Score 30-50: Unverified, no interaction history
- Score 50-70: Verified but no recent interaction
- Score 70-85: Verified + recent interaction
- Score 85-100: Verified + active engagement

**Sender Integration:**
```javascript
// In senderService.js
if (prospect.score_contactabilidad < 70) {
    throw new Error('INSUFFICIENT_CONTACTABILITY_SCORE');
}
```

---

### 2. score_madurez_digital (0-100)

**Definition:** Level of digital presence and engagement, indicating receptiveness to digital communication.

**Data Sources:**
- Website existence and quality (llxbx_societe.url)
- Email domain type (generic vs corporate)
- Social media presence (LinkedIn, Facebook, Instagram)
- Google My Business listing
- Online reviews/ratings

**Scoring Factors:**

| Factor | Weight | Score Contribution |
|--------|--------|-------------------|
| Corporate website exists | 35% | 0 or 35 |
| Corporate email domain | 25% | 0 or 25 |
| Social media presence | 25% | 0-25 (multiple platforms) |
| Google My Business | 15% | 0 or 15 |

**Formula (v1.0):**
```javascript
score_madurez_digital = (
    (has_website ? 35 : 0) +
    (has_corporate_email ? 25 : 0) +
    (social_media_count * 8.33) +        // max 3 platforms * 8.33 = 25
    (has_google_business ? 15 : 0)
)

where:
    has_website = url IS NOT NULL AND url != ''
    has_corporate_email = email_domain != 'gmail|hotmail|yahoo|outlook'
    social_media_count = COUNT(linkedin_url, facebook_url, instagram_url)
```

**Business Rules:**
- Score < 25: Minimal digital presence (high-touch needed)
- Score 25-50: Basic digital presence (educational approach)
- Score 50-75: Moderate digital maturity (standard outreach)
- Score 75-100: Advanced digital presence (technical pitch)

---

### 3. score_potencial (0-100)

**Definition:** Estimated commercial value and strategic fit as a client.

**Data Sources:**
- Company size indicators (revenue, employees)
- Industry vertical (from Dolibarr categories)
- Geographic location
- Previous purchase history (if exists)
- Engagement history (emails opened, links clicked)

**Scoring Factors:**

| Factor | Weight | Score Contribution |
|--------|--------|-------------------|
| Company size (revenue/employees) | 40% | 0-40 (tiered) |
| Strategic industry fit | 30% | 0-30 (predefined list) |
| Geographic targeting | 15% | 0 or 15 |
| Engagement history | 15% | 0-15 (behavioral) |

**Formula (v1.0):**
```javascript
score_potencial = (
    (size_tier_score * 40) +             // 0-1 scale
    (industry_fit_score * 30) +          // 0-1 scale
    (geo_target_match ? 15 : 0) +
    (engagement_score * 15)              // 0-1 scale
)

where:
    size_tier_score = categorizeSize(revenue, employees)
    industry_fit_score = industryFitMatrix[industry_code]
    geo_target_match = location IN target_regions
    engagement_score = calculateEngagement(opens, clicks, visits)
```

**Business Rules:**
- Score < 25: Low potential (deprioritize)
- Score 25-50: Moderate potential (standard pipeline)
- Score 50-75: High potential (priority outreach)
- Score 75-100: Strategic target (executive engagement)

---

### 4. score_total (0-100)

**Definition:** Composite score combining all dimensions with strategic weights.

**Formula (v1.0):**
```javascript
score_total = (
    score_contactabilidad * 0.35 +       // 35% weight - must be reachable
    score_madurez_digital * 0.25 +       // 25% weight - digital readiness
    score_potencial * 0.40               // 40% weight - commercial value
)
```

**Rationale:**
- **Contactability is critical but not sufficient:** 35% weight ensures we can reach them
- **Digital maturity signals receptiveness:** 25% weight for qualification
- **Potential drives ROI:** 40% weight because revenue potential matters most

**Calibration Strategy:**
- Run scoring on existing client base (known good prospects)
- Analyze score distribution
- Adjust weights if scores cluster incorrectly
- Target distribution:
  - Top 10% (score >= 80): Strategic accounts
  - Next 20% (score 65-80): High priority
  - Next 40% (score 40-65): Standard pipeline
  - Bottom 30% (score < 40): Deprioritize or nurture

---

### 5. nivel_calidad (ENUM: 'A', 'B', 'C', 'D')

**Definition:** Human-readable classification derived from score_total.

**Mapping:**
```sql
nivel_calidad = CASE
    WHEN score_total >= 75 THEN 'A'  -- Strategic priority
    WHEN score_total >= 55 THEN 'B'  -- High priority
    WHEN score_total >= 35 THEN 'C'  -- Standard pipeline
    ELSE 'D'                         -- Low priority / nurture
END
```

**Business Rules:**
- **Class A:** Executive engagement, dedicated account manager, custom proposals
- **Class B:** Team lead engagement, priority response, standard proposals
- **Class C:** Standard sales process, automated follow-up
- **Class D:** Drip campaigns, educational content, defer direct outreach

**Usage:**
```sql
-- Query for high-priority prospects
SELECT s.rowid, s.nom, ex.score_total, ex.nivel_calidad
FROM llxbx_societe s
JOIN ll_societe_extended ex ON s.rowid = ex.societe_id
WHERE ex.nivel_calidad IN ('A', 'B')
  AND ex.validado_tecnicamente = 1
ORDER BY ex.score_total DESC;
```

---

### 6. validado_tecnicamente (BOOLEAN: 0/1)

**Definition:** Technical validation that prospect meets minimum data quality and contactability standards.

**Validation Criteria:**
```javascript
validado_tecnicamente = (
    phone_exists &&
    phone_format_valid &&
    (whatsapp_verified || score_contactabilidad >= 50) &&
    no_bounce_history
)
```

**Business Rules:**
- **MUST be 1** before any outbound WhatsApp sending
- Set to 0 if phone number bounces or is invalid
- Re-validation required every 90 days
- Manual override allowed with audit log

**Sender Integration (BLOCKING):**
```javascript
// In scoringMiddleware.js
exports.validateSendingEligibility = async (req, res, next) => {
    const { societe_id } = req.body;
    
    const scoring = await db.query(
        'SELECT validado_tecnicamente, score_contactabilidad FROM ll_societe_extended WHERE societe_id = ?',
        [societe_id]
    );
    
    if (!scoring.validado_tecnicamente) {
        return res.status(403).json({
            error: 'TECHNICAL_VALIDATION_REQUIRED',
            message: 'Prospect not technically validated for sending'
        });
    }
    
    if (scoring.score_contactabilidad < 70) {
        return res.status(403).json({
            error: 'INSUFFICIENT_CONTACTABILITY',
            message: 'Contactability score below threshold (70)',
            current_score: scoring.score_contactabilidad
        });
    }
    
    next();
};
```

---

### 7. validado_comercialmente (BOOLEAN: 0/1)

**Definition:** Commercial validation that prospect is qualified as a legitimate sales opportunity.

**Validation Criteria (Manual/Semi-automated):**
- Sales rep reviewed prospect profile
- Confirmed budget/authority/need/timeline (BANT)
- No conflicts with existing clients
- Not in exclusion list (competitors, partners)
- Approved for outreach by management (if required)

**Business Rules:**
- **Recommended but NOT blocking** for sending (unlike technical validation)
- Required for Class A prospects before executive engagement
- Can be set by sales team via frontend
- Audit log required for commercial validation changes

**Usage:**
```sql
-- Query for fully qualified prospects
SELECT s.rowid, s.nom, ex.score_total, ex.nivel_calidad
FROM llxbx_societe s
JOIN ll_societe_extended ex ON s.rowid = ex.societe_id
WHERE ex.validado_tecnicamente = 1
  AND ex.validado_comercialmente = 1
  AND ex.nivel_calidad IN ('A', 'B')
ORDER BY ex.score_total DESC;
```

---

### 8. fecha_scoring (DATETIME)

**Definition:** Timestamp of last scoring calculation, enables freshness tracking.

**Business Rules:**
- Set to `NOW()` whenever scoring runs
- NULL indicates prospect never scored
- Scoring older than 90 days considered stale
- Trigger re-scoring if:
  - Core prospect data changes (phone, email, company data)
  - New interaction recorded (WhatsApp reply, email open)
  - Manual re-scoring requested

**Staleness Detection:**
```sql
-- Find prospects needing re-scoring
SELECT societe_id, fecha_scoring, DATEDIFF(NOW(), fecha_scoring) AS dias_desde_scoring
FROM ll_societe_extended
WHERE fecha_scoring IS NULL
   OR DATEDIFF(NOW(), fecha_scoring) > 90
ORDER BY fecha_scoring ASC
LIMIT 100;
```

**Automated Re-scoring Strategy (Future Enhancement):**
- Scheduled job runs nightly
- Re-scores prospects with stale scores
- Prioritizes high-value prospects (Class A/B)
- Logs scoring run metrics

---

## SQL Migration Draft

### Migration Script: `migrations/004_add_scoring_fields.sql`

```sql
-- ============================================================================
-- Migration: Add Commercial Intelligence & Prospect Scoring Fields
-- Phase: 4
-- Date: 2026-02-21
-- Description: Extends ll_societe_extended with scoring dimensions
-- ============================================================================

USE iunaorg_dyd;

-- Check if ll_societe_extended table exists
SET @table_exists = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
);

-- If table doesn't exist, create it with FK to llxbx_societe
SET @create_table = IF(@table_exists = 0,
    'CREATE TABLE ll_societe_extended (
        societe_id INT NOT NULL PRIMARY KEY,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (societe_id) REFERENCES llxbx_societe(rowid) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    'SELECT "Table ll_societe_extended already exists" AS info;'
);

PREPARE stmt FROM @create_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Add Scoring Dimension Fields
-- ============================================================================

-- score_contactabilidad: Contact reachability probability (0-100)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'score_contactabilidad'
);

SET @add_score_contactabilidad = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN score_contactabilidad TINYINT UNSIGNED DEFAULT NULL
     COMMENT "Contactability score 0-100: phone validity, WhatsApp verification, interaction history";',
    'SELECT "Column score_contactabilidad already exists" AS info;'
);

PREPARE stmt FROM @add_score_contactabilidad;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- score_madurez_digital: Digital presence maturity (0-100)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'score_madurez_digital'
);

SET @add_score_madurez = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN score_madurez_digital TINYINT UNSIGNED DEFAULT NULL
     COMMENT "Digital maturity score 0-100: website, corporate email, social media presence";',
    'SELECT "Column score_madurez_digital already exists" AS info;'
);

PREPARE stmt FROM @add_score_madurez;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- score_potencial: Commercial opportunity potential (0-100)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'score_potencial'
);

SET @add_score_potencial = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN score_potencial TINYINT UNSIGNED DEFAULT NULL
     COMMENT "Commercial potential score 0-100: company size, industry fit, engagement history";',
    'SELECT "Column score_potencial already exists" AS info;'
);

PREPARE stmt FROM @add_score_potencial;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- score_total: Composite weighted score (0-100)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'score_total'
);

SET @add_score_total = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN score_total TINYINT UNSIGNED DEFAULT NULL
     COMMENT "Composite score 0-100: weighted combination of all dimensions";',
    'SELECT "Column score_total already exists" AS info;'
);

PREPARE stmt FROM @add_score_total;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- nivel_calidad: Human-readable classification (A/B/C/D)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'nivel_calidad'
);

SET @add_nivel_calidad = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN nivel_calidad ENUM("A", "B", "C", "D") DEFAULT NULL
     COMMENT "Quality classification: A=Strategic, B=High priority, C=Standard, D=Low priority";',
    'SELECT "Column nivel_calidad already exists" AS info;'
);

PREPARE stmt FROM @add_nivel_calidad;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- validado_tecnicamente: Technical validation flag (0/1)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'validado_tecnicamente'
);

SET @add_validado_tech = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN validado_tecnicamente TINYINT(1) DEFAULT 0
     COMMENT "Technical validation: 1=approved for sending, 0=not validated";',
    'SELECT "Column validado_tecnicamente already exists" AS info;'
);

PREPARE stmt FROM @add_validado_tech;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- validado_comercialmente: Commercial validation flag (0/1)
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'validado_comercialmente'
);

SET @add_validado_com = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN validado_comercialmente TINYINT(1) DEFAULT 0
     COMMENT "Commercial validation: 1=sales qualified, 0=not qualified";',
    'SELECT "Column validado_comercialmente already exists" AS info;'
);

PREPARE stmt FROM @add_validado_com;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- fecha_scoring: Last scoring calculation timestamp
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND column_name = 'fecha_scoring'
);

SET @add_fecha_scoring = IF(@col_exists = 0,
    'ALTER TABLE ll_societe_extended
     ADD COLUMN fecha_scoring DATETIME DEFAULT NULL
     COMMENT "Timestamp of last scoring calculation";',
    'SELECT "Column fecha_scoring already exists" AS info;'
);

PREPARE stmt FROM @add_fecha_scoring;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Add Indexes for Query Performance
-- ============================================================================

-- Index on score_total for sorting qualified prospects
SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND index_name = 'idx_score_total'
);

SET @add_idx_score = IF(@idx_exists = 0,
    'CREATE INDEX idx_score_total ON ll_societe_extended(score_total DESC);',
    'SELECT "Index idx_score_total already exists" AS info;'
);

PREPARE stmt FROM @add_idx_score;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on validado_tecnicamente for filtering sendable prospects
SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND index_name = 'idx_validado_tecnicamente'
);

SET @add_idx_val_tech = IF(@idx_exists = 0,
    'CREATE INDEX idx_validado_tecnicamente ON ll_societe_extended(validado_tecnicamente);',
    'SELECT "Index idx_validado_tecnicamente already exists" AS info;'
);

PREPARE stmt FROM @add_idx_val_tech;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Composite index for sender eligibility queries
SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND index_name = 'idx_sender_eligibility'
);

SET @add_idx_eligibility = IF(@idx_exists = 0,
    'CREATE INDEX idx_sender_eligibility ON ll_societe_extended(validado_tecnicamente, score_contactabilidad);',
    'SELECT "Index idx_sender_eligibility already exists" AS info;'
);

PREPARE stmt FROM @add_idx_eligibility;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on fecha_scoring for staleness detection
SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = 'iunaorg_dyd'
      AND table_name = 'll_societe_extended'
      AND index_name = 'idx_fecha_scoring'
);

SET @add_idx_fecha = IF(@idx_exists = 0,
    'CREATE INDEX idx_fecha_scoring ON ll_societe_extended(fecha_scoring);',
    'SELECT "Index idx_fecha_scoring already exists" AS info;'
);

PREPARE stmt FROM @add_idx_fecha;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Show updated table structure
DESCRIBE ll_societe_extended;

-- Show created indexes
SHOW INDEXES FROM ll_societe_extended;

-- Count prospects ready for scoring (existing records)
SELECT COUNT(*) AS prospects_to_score
FROM ll_societe_extended
WHERE fecha_scoring IS NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================

SELECT 'Phase 4 scoring fields migration completed successfully' AS status;
```

### Rollback Script: `migrations/004_rollback_scoring_fields.sql`

```sql
-- ============================================================================
-- Rollback: Remove Commercial Intelligence & Prospect Scoring Fields
-- Phase: 4
-- Date: 2026-02-21
-- WARNING: This will delete scoring data permanently
-- ============================================================================

USE iunaorg_dyd;

-- Drop indexes first
DROP INDEX IF EXISTS idx_score_total ON ll_societe_extended;
DROP INDEX IF EXISTS idx_validado_tecnicamente ON ll_societe_extended;
DROP INDEX IF EXISTS idx_sender_eligibility ON ll_societe_extended;
DROP INDEX IF EXISTS idx_fecha_scoring ON ll_societe_extended;

-- Drop scoring columns
ALTER TABLE ll_societe_extended
    DROP COLUMN IF EXISTS score_contactabilidad,
    DROP COLUMN IF EXISTS score_madurez_digital,
    DROP COLUMN IF EXISTS score_potencial,
    DROP COLUMN IF EXISTS score_total,
    DROP COLUMN IF EXISTS nivel_calidad,
    DROP COLUMN IF EXISTS validado_tecnicamente,
    DROP COLUMN IF EXISTS validado_comercialmente,
    DROP COLUMN IF EXISTS fecha_scoring;

SELECT 'Phase 4 scoring fields rollback completed' AS status;
```

### Migration Execution Plan

1. **Backup Database:**
   ```bash
   mysqldump -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd > backup_pre_phase4_$(date +%Y%m%d).sql
   ```

2. **Run Migration:**
   ```bash
   mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd < migrations/004_add_scoring_fields.sql
   ```

3. **Verify:**
   ```sql
   DESCRIBE ll_societe_extended;
   SHOW INDEXES FROM ll_societe_extended;
   SELECT COUNT(*) FROM ll_societe_extended WHERE fecha_scoring IS NULL;
   ```

4. **If Rollback Needed:**
   ```bash
   mysql -h sv46.byethost46.org -u iunaorg_b3toh -p iunaorg_dyd < migrations/004_rollback_scoring_fields.sql
   ```

---

## Initial Scoring Formula Proposal

### Formula Implementation: `scoringFormulas.js`

```javascript
/**
 * Phase 4 - Commercial Intelligence Scoring Formulas
 * Version: 1.0
 * Date: 2026-02-21
 */

class ScoringFormulas {
    
    /**
     * Calculate contactability score (0-100)
     * Factors: phone validity, WhatsApp verification, interaction history, data freshness
     */
    static calculateContactability(prospectData) {
        let score = 0;
        
        // Factor 1: Valid mobile format (30 points)
        const phoneValid = this.validateMobileFormat(prospectData.phone);
        if (phoneValid) score += 30;
        
        // Factor 2: WhatsApp verified (40 points)
        if (prospectData.whatsapp_verified === 1) {
            score += 40;
        }
        
        // Factor 3: Previous interaction (20 points, decay-based)
        if (prospectData.last_interaction_date) {
            const daysSinceInteraction = this.daysBetween(
                new Date(prospectData.last_interaction_date),
                new Date()
            );
            
            if (daysSinceInteraction < 90) {
                score += 20; // Recent interaction
            } else if (daysSinceInteraction < 180) {
                score += 10; // Older interaction
            }
        }
        
        // Factor 4: Data freshness (10 points, decay-based)
        if (prospectData.actualizado_en) {
            const daysSinceUpdate = this.daysBetween(
                new Date(prospectData.actualizado_en),
                new Date()
            );
            
            const freshnessScore = Math.max(0, 1 - (daysSinceUpdate / 365));
            score += Math.round(freshnessScore * 10);
        }
        
        return Math.min(100, Math.max(0, score));
    }
    
    /**
     * Calculate digital maturity score (0-100)
     * Factors: website, corporate email, social media, Google Business
     */
    static calculateDigitalMaturity(prospectData) {
        let score = 0;
        
        // Factor 1: Corporate website (35 points)
        if (prospectData.url && prospectData.url.trim() !== '') {
            score += 35;
        }
        
        // Factor 2: Corporate email domain (25 points)
        if (prospectData.email && this.isCorporateEmail(prospectData.email)) {
            score += 25;
        }
        
        // Factor 3: Social media presence (25 points total, 8.33 per platform)
        const socialPlatforms = [
            prospectData.linkedin_url,
            prospectData.facebook_url,
            prospectData.instagram_url
        ].filter(url => url && url.trim() !== '');
        
        score += Math.round(socialPlatforms.length * 8.33);
        
        // Factor 4: Google My Business (15 points)
        if (prospectData.google_business_verified === 1) {
            score += 15;
        }
        
        return Math.min(100, Math.max(0, score));
    }
    
    /**
     * Calculate commercial potential score (0-100)
     * Factors: company size, industry fit, geography, engagement
     */
    static calculatePotential(prospectData, industryFitMatrix = {}) {
        let score = 0;
        
        // Factor 1: Company size tier (40 points)
        const sizeTier = this.categorizeCompanySize(
            prospectData.revenue,
            prospectData.employees
        );
        score += sizeTier * 40; // sizeTier is 0-1 scale
        
        // Factor 2: Industry strategic fit (30 points)
        const industryCode = prospectData.fk_typent; // Dolibarr industry code
        const industryFit = industryFitMatrix[industryCode] || 0.5; // Default 0.5
        score += industryFit * 30;
        
        // Factor 3: Geographic targeting (15 points)
        const targetRegions = ['Buenos Aires', 'CABA', 'Córdoba', 'Rosario'];
        const location = prospectData.town || prospectData.town;
        if (targetRegions.some(region => location?.includes(region))) {
            score += 15;
        }
        
        // Factor 4: Engagement history (15 points)
        const engagementScore = this.calculateEngagement(prospectData);
        score += engagementScore * 15; // engagementScore is 0-1 scale
        
        return Math.min(100, Math.max(0, Math.round(score)));
    }
    
    /**
     * Calculate composite total score (0-100)
     * Weighted combination: contactability 35%, maturity 25%, potential 40%
     */
    static calculateTotalScore(scoreContactabilidad, scoreMadurez, scorePotencial) {
        const total = (
            scoreContactabilidad * 0.35 +
            scoreMadurez * 0.25 +
            scorePotencial * 0.40
        );
        
        return Math.round(Math.min(100, Math.max(0, total)));
    }
    
    /**
     * Classify score into quality level (A/B/C/D)
     */
    static classifyQualityLevel(scoreTotal) {
        if (scoreTotal >= 75) return 'A';
        if (scoreTotal >= 55) return 'B';
        if (scoreTotal >= 35) return 'C';
        return 'D';
    }
    
    /**
     * Determine technical validation eligibility
     */
    static determineTechnicalValidation(prospectData, scoreContactabilidad) {
        return (
            prospectData.phone !== null &&
            prospectData.phone !== '' &&
            this.validateMobileFormat(prospectData.phone) &&
            (prospectData.whatsapp_verified === 1 || scoreContactabilidad >= 50) &&
            prospectData.bounce_count === 0
        );
    }
    
    // ========================================================================
    // Helper Methods
    // ========================================================================
    
    static validateMobileFormat(phone) {
        if (!phone) return false;
        
        // Remove non-digits
        const cleaned = phone.replace(/\D/g, '');
        
        // Argentina mobile: 54 9 area code (2-4 digits) + number (6-8 digits)
        // Total: 11-13 digits with country code
        const argentinaPattern = /^54\d{9,11}$/;
        
        // Generic mobile: 10-15 digits
        const genericPattern = /^\d{10,15}$/;
        
        return argentinaPattern.test(cleaned) || genericPattern.test(cleaned);
    }
    
    static isCorporateEmail(email) {
        if (!email) return false;
        
        const genericDomains = [
            'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com',
            'live.com', 'icloud.com', 'protonmail.com'
        ];
        
        const domain = email.split('@')[1]?.toLowerCase();
        return domain && !genericDomains.includes(domain);
    }
    
    static categorizeCompanySize(revenue, employees) {
        // Tier scoring: 0 (unknown), 0.25 (micro), 0.5 (small), 0.75 (medium), 1.0 (large)
        
        if (employees >= 200 || revenue >= 10000000) return 1.0;  // Large
        if (employees >= 50 || revenue >= 2000000) return 0.75;   // Medium
        if (employees >= 10 || revenue >= 500000) return 0.5;     // Small
        if (employees >= 1 || revenue >= 100000) return 0.25;     // Micro
        return 0; // Unknown/no data
    }
    
    static calculateEngagement(prospectData) {
        // Engagement from emails opened, links clicked, website visits
        let engagement = 0;
        
        if (prospectData.emails_opened > 0) engagement += 0.4;
        if (prospectData.links_clicked > 0) engagement += 0.3;
        if (prospectData.website_visits > 0) engagement += 0.3;
        
        return Math.min(1, engagement);
    }
    
    static daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000; // milliseconds
        return Math.round(Math.abs((date1 - date2) / oneDay));
    }
}

module.exports = ScoringFormulas;
```

### Formula Calibration Strategy

1. **Baseline Calibration (Week 1):**
   - Run scoring on all existing prospects
   - Analyze distribution of `score_total`
   - Identify known good clients and their scores
   - Adjust weights if scores don't match business intuition

2. **A/B Testing (Week 2-4):**
   - Segment prospects by score ranges
   - Run campaigns to both high and medium scores
   - Measure conversion rates by score band
   - Refine formulas based on actual conversion data

3. **Continuous Improvement:**
   - Monthly review of scoring accuracy
   - Quarterly formula adjustments
   - Annual major revision based on accumulated data

---

## Integration Rules

### 1. Sender Module Integration

**Critical Rule:** Sender MUST validate scoring before sending any WhatsApp message.

**Implementation: `scoringMiddleware.js`**

```javascript
/**
 * Scoring Middleware for Sender Module
 * Enforces technical validation and contactability threshold
 */

const db = require('../../../shared/db');

/**
 * Middleware: Validate prospect eligibility for sending
 * BLOCKS sending if validation fails
 */
exports.validateSendingEligibility = async (req, res, next) => {
    try {
        const { societe_id, societe_ids } = req.body;
        
        // Handle single or bulk sending
        const idsToValidate = societe_id ? [societe_id] : (societe_ids || []);
        
        if (idsToValidate.length === 0) {
            return res.status(400).json({
                error: 'MISSING_PROSPECT_ID',
                message: 'No prospect ID(s) provided for validation'
            });
        }
        
        // Query scoring data for all prospects
        const [scoringData] = await db.query(
            `SELECT 
                societe_id,
                score_contactabilidad,
                validado_tecnicamente,
                fecha_scoring
             FROM ll_societe_extended
             WHERE societe_id IN (?)`,
            [idsToValidate]
        );
        
        // Validate each prospect
        const failures = [];
        
        for (const id of idsToValidate) {
            const scoring = scoringData.find(s => s.societe_id === id);
            
            // Check 1: Scoring data exists
            if (!scoring) {
                failures.push({
                    societe_id: id,
                    reason: 'NO_SCORING_DATA',
                    message: 'Prospect has not been scored yet'
                });
                continue;
            }
            
            // Check 2: Technical validation (BLOCKING)
            if (!scoring.validado_tecnicamente) {
                failures.push({
                    societe_id: id,
                    reason: 'NOT_TECHNICALLY_VALIDATED',
                    message: 'Prospect not technically validated for sending'
                });
                continue;
            }
            
            // Check 3: Contactability threshold (BLOCKING)
            if (scoring.score_contactabilidad < 70) {
                failures.push({
                    societe_id: id,
                    reason: 'INSUFFICIENT_CONTACTABILITY',
                    message: `Contactability score below threshold (70)`,
                    current_score: scoring.score_contactabilidad
                });
                continue;
            }
            
            // Check 4: Stale scoring (WARNING, not blocking)
            if (scoring.fecha_scoring) {
                const daysSinceScoring = Math.floor(
                    (new Date() - new Date(scoring.fecha_scoring)) / (1000 * 60 * 60 * 24)
                );
                
                if (daysSinceScoring > 90) {
                    // Log warning but don't block
                    console.warn(`[Scoring Middleware] Stale scoring for societe_id=${id}: ${daysSinceScoring} days old`);
                }
            }
        }
        
        // If any validation failures, return 403 Forbidden
        if (failures.length > 0) {
            return res.status(403).json({
                error: 'SCORING_VALIDATION_FAILED',
                message: `${failures.length} prospect(s) failed scoring validation`,
                failures: failures,
                validated_count: idsToValidate.length - failures.length,
                failed_count: failures.length
            });
        }
        
        // All validations passed
        req.validatedProspects = idsToValidate;
        next();
        
    } catch (error) {
        console.error('[Scoring Middleware] Validation error:', error);
        return res.status(500).json({
            error: 'SCORING_VALIDATION_ERROR',
            message: 'Error validating prospect scoring',
            details: error.message
        });
    }
};

/**
 * Middleware: Recommend prospects based on scoring
 * Returns sorted list of eligible prospects (does NOT block)
 */
exports.recommendProspects = async (req, res, next) => {
    try {
        const { limit = 100, min_score = 55, nivel_calidad = ['A', 'B'] } = req.query;
        
        const [prospects] = await db.query(
            `SELECT 
                s.rowid,
                s.nom AS company_name,
                s.email,
                s.phone,
                ex.score_total,
                ex.score_contactabilidad,
                ex.score_madurez_digital,
                ex.score_potencial,
                ex.nivel_calidad,
                ex.fecha_scoring
             FROM llxbx_societe s
             JOIN ll_societe_extended ex ON s.rowid = ex.societe_id
             WHERE ex.validado_tecnicamente = 1
               AND ex.score_contactabilidad >= 70
               AND ex.score_total >= ?
               AND ex.nivel_calidad IN (?)
             ORDER BY ex.score_total DESC, ex.fecha_scoring DESC
             LIMIT ?`,
            [min_score, nivel_calidad, parseInt(limit)]
        );
        
        req.recommendedProspects = prospects;
        res.json({
            success: true,
            count: prospects.length,
            prospects: prospects
        });
        
    } catch (error) {
        console.error('[Scoring Middleware] Recommendation error:', error);
        return res.status(500).json({
            error: 'RECOMMENDATION_ERROR',
            message: 'Error generating prospect recommendations',
            details: error.message
        });
    }
};
```

### 2. Sender Service Integration

**Modified: `senderService.js`**

```javascript
// In senderService.js

const scoringMiddleware = require('../scoring/scoringMiddleware');

/**
 * Send WhatsApp message (with scoring validation)
 */
exports.sendMessage = async (societe_id, message, cliente_id) => {
    // PRE-FLIGHT: Validate scoring eligibility
    const scoringCheck = await validateProspectScoring(societe_id);
    
    if (!scoringCheck.eligible) {
        throw new Error(`SCORING_BLOCKED: ${scoringCheck.reason}`);
    }
    
    // Proceed with sending...
    // (existing sending logic)
};

/**
 * Helper: Validate prospect scoring before sending
 */
async function validateProspectScoring(societe_id) {
    const [scoring] = await db.query(
        `SELECT 
            validado_tecnicamente,
            score_contactabilidad,
            score_total,
            nivel_calidad
         FROM ll_societe_extended
         WHERE societe_id = ?`,
        [societe_id]
    );
    
    if (!scoring.length) {
        return { eligible: false, reason: 'No scoring data' };
    }
    
    if (!scoring[0].validado_tecnicamente) {
        return { eligible: false, reason: 'Not technically validated' };
    }
    
    if (scoring[0].score_contactabilidad < 70) {
        return { eligible: false, reason: `Contactability score too low (${scoring[0].score_contactabilidad})` };
    }
    
    return { eligible: true, scoring: scoring[0] };
}
```

### 3. Sender API Route Integration

**Modified: `routes/sender.js`**

```javascript
const express = require('express');
const router = express.Router();
const senderController = require('../controllers/senderController');
const authMiddleware = require('../middlewares/authMiddleware');
const scoringMiddleware = require('../scoring/scoringMiddleware'); // NEW

// All routes require authentication
router.use(authMiddleware.authenticate);

// POST /sender/send - Send single message
// SCORING VALIDATION ENFORCED
router.post('/send',
    scoringMiddleware.validateSendingEligibility, // NEW: Scoring check
    senderController.sendMessage
);

// POST /sender/bulk-send - Send bulk messages
// SCORING VALIDATION ENFORCED
router.post('/bulk-send',
    scoringMiddleware.validateSendingEligibility, // NEW: Scoring check
    senderController.sendBulkMessages
);

// GET /sender/recommend - Get recommended prospects
router.get('/recommend',
    scoringMiddleware.recommendProspects
);

module.exports = router;
```

### 4. Listener Module Integration (Future)

**Planned: Update scores on interactions**

```javascript
// In listenerService.js

/**
 * After receiving WhatsApp message, update contactability score
 */
exports.handleIncomingMessage = async (from, message) => {
    // Existing message handling...
    
    // Update scoring: interaction detected
    await updateInteractionScoring(from);
};

async function updateInteractionScoring(phone) {
    // Find societe by phone
    const [societe] = await db.query(
        'SELECT rowid FROM llxbx_societe WHERE phone = ?',
        [phone]
    );
    
    if (societe.length) {
        const societe_id = societe[0].rowid;
        
        // Increment interaction indicator
        await db.query(
            `UPDATE ll_societe_extended
             SET actualizado_en = NOW()
             WHERE societe_id = ?`,
            [societe_id]
        );
        
        // Trigger re-scoring (async, non-blocking)
        // TODO: Implement scoring service trigger
    }
}
```

---

## API Contracts (Planned)

### Scoring API Endpoints (Phase 4 Implementation)

```
GET  /scoring/calculate/:societe_id    - Calculate/recalculate scores for one prospect
POST /scoring/calculate-bulk           - Calculate scores for multiple prospects
GET  /scoring/:societe_id              - Get current scoring for one prospect
GET  /scoring/stale                    - List prospects with stale scoring (>90 days)
POST /scoring/validate-technical       - Manually set technical validation
POST /scoring/validate-commercial      - Manually set commercial validation
```

### Example Request/Response

**Request: Calculate Scoring**
```http
GET /scoring/calculate/12345
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
    "success": true,
    "societe_id": 12345,
    "scoring": {
        "score_contactabilidad": 75,
        "score_madurez_digital": 60,
        "score_potencial": 85,
        "score_total": 75,
        "nivel_calidad": "A",
        "validado_tecnicamente": true,
        "validado_comercialmente": false,
        "fecha_scoring": "2026-02-21T15:30:00Z"
    },
    "breakdown": {
        "contactabilidad_factors": {
            "phone_valid": 30,
            "whatsapp_verified": 40,
            "recent_interaction": 5,
            "data_freshness": 0
        },
        "madurez_factors": {
            "website": 35,
            "corporate_email": 25,
            "social_media": 0,
            "google_business": 0
        },
        "potencial_factors": {
            "company_size": 32,
            "industry_fit": 24,
            "geography": 15,
            "engagement": 14
        }
    },
    "sending_eligible": true
}
```

---

## Testing Strategy (Not Implemented Yet)

### Unit Tests (scoringFormulas.test.js)

```javascript
describe('ScoringFormulas', () => {
    describe('calculateContactability', () => {
        it('should return 70 for valid mobile + WhatsApp verified', () => {
            const data = {
                phone: '5491112345678',
                whatsapp_verified: 1
            };
            expect(ScoringFormulas.calculateContactability(data)).toBe(70);
        });
        
        it('should return 0 for invalid phone', () => {
            const data = { phone: 'invalid' };
            expect(ScoringFormulas.calculateContactability(data)).toBe(0);
        });
    });
    
    describe('calculateTotalScore', () => {
        it('should calculate weighted composite correctly', () => {
            const total = ScoringFormulas.calculateTotalScore(80, 60, 70);
            // 80*0.35 + 60*0.25 + 70*0.40 = 28 + 15 + 28 = 71
            expect(total).toBe(71);
        });
    });
});
```

### Integration Tests (scoring.integration.test.js)

```javascript
describe('Scoring Integration', () => {
    it('should block sending when score_contactabilidad < 70', async () => {
        const response = await request(app)
            .post('/sender/send')
            .set('Authorization', `Bearer ${token}`)
            .send({
                societe_id: 999, // Has score_contactabilidad = 50
                message: 'Test message'
            });
        
        expect(response.status).toBe(403);
        expect(response.body.error).toBe('SCORING_VALIDATION_FAILED');
    });
    
    it('should allow sending when scoring validates', async () => {
        const response = await request(app)
            .post('/sender/send')
            .set('Authorization', `Bearer ${token}`)
            .send({
                societe_id: 123, // Has score_contactabilidad = 80, validated
                message: 'Test message'
            });
        
        expect(response.status).toBe(200);
    });
});
```

---

## Rollout Plan

### Phase 4.1: Schema Migration (Day 1)

- [ ] Backup production database
- [ ] Run migration script on staging
- [ ] Verify column creation
- [ ] Verify indexes created
- [ ] Run migration on production
- [ ] Document any issues

### Phase 4.2: Scoring Engine (Days 2-3)

- [ ] Implement `scoringFormulas.js`
- [ ] Implement `scoringService.js`
- [ ] Implement `scoringController.js`
- [ ] Write unit tests for formulas
- [ ] Test scoring calculation on sample data
- [ ] Calibrate formula weights

### Phase 4.3: Middleware Integration (Day 3)

- [ ] Implement `scoringMiddleware.js`
- [ ] Integrate middleware into sender routes
- [ ] Test blocking behavior
- [ ] Test recommendation endpoint
- [ ] Write integration tests

### Phase 4.4: Frontend Integration (Day 4)

- [ ] Add scoring display in prospect list
- [ ] Add filters by nivel_calidad
- [ ] Add sorting by score_total
- [ ] Show scoring breakdown on prospect detail
- [ ] Add manual validation buttons (technical/commercial)

### Phase 4.5: Validation & Deployment

- [ ] Run scoring on all existing prospects
- [ ] Analyze score distribution
- [ ] Validate with sample sending campaigns
- [ ] Document calibration results
- [ ] Deploy to production
- [ ] Monitor for 1 week

---

## Success Metrics

### Technical Metrics

- **Scoring coverage:** 100% of prospects have `fecha_scoring` within 90 days
- **Validation rate:** >= 80% of prospects have `validado_tecnicamente = 1`
- **Query performance:** Sender eligibility queries < 50ms
- **Scoring calculation time:** < 100ms per prospect

### Business Metrics

- **Sending efficiency:** % of sent messages to validated prospects (target: 100%)
- **Response rate improvement:** Compare pre/post scoring implementation
- **Conversion rate by tier:** Class A conversion vs Class C conversion
- **Wasted effort reduction:** % reduction in sends to unresponsive prospects

### Data Quality Metrics

- **Scoring freshness:** % of prospects scored within 90 days (target: >90%)
- **Zero scores:** % of prospects with score_total = 0 (should be rare)
- **Missing data impact:** % of prospects with incomplete data affecting scores

---

## Risks & Mitigations

### Risk 1: Formula Miscalibration

**Impact:** Scores don't reflect actual prospect quality  
**Probability:** Medium  
**Mitigation:**
- Run scoring on historical data with known outcomes
- A/B test score bands against conversion rates
- Implement quarterly calibration reviews
- Allow manual overrides with audit logging

### Risk 2: Performance Degradation

**Impact:** Slow queries when filtering by scoring fields  
**Probability:** Low  
**Mitigation:**
- Indexes on all scoring fields
- Composite index for sender eligibility
- Query plan analysis before production
- Monitor query performance post-deployment

### Risk 3: Data Quality Issues

**Impact:** Incomplete prospect data leads to inaccurate scores  
**Probability:** High  
**Mitigation:**
- Null field handling in formulas
- Data quality dashboard
- Gradual scoring rollout (validate data first)
- Manual data enrichment process

### Risk 4: Over-restrictive Validation

**Impact:** Blocks sending to legitimate prospects  
**Probability:** Medium  
**Mitigation:**
- Start with lower thresholds (e.g., 60 instead of 70)
- Manual override capability for sales team
- Whitelist functionality for known good prospects
- Adjust thresholds based on campaign results

---

## Future Enhancements (Post Phase 4)

### Machine Learning Integration

- Train ML model on historical conversion data
- Replace hand-crafted formulas with learned weights
- Predict conversion probability (not just score)
- Continuously retrain on new data

### External Data Enrichment

- Integrate with business data providers (D&B, ZoomInfo)
- Real-time company data verification
- Social media sentiment analysis
- Technographic data (tech stack detection)

### Dynamic Scoring

- Real-time score updates on interactions
- Event-driven re-scoring (not just scheduled)
- Behavioral scoring (engagement patterns)
- Decay functions for stale prospects

### Advanced Segmentation

- Propensity-to-buy modeling
- Customer lifetime value prediction
- Churn risk scoring (for existing clients)
- Lookalike modeling (find prospects similar to best clients)

---

## Documentation & Communication

### Documentation Deliverables

- ✅ This document (PHASE-4-COMMERCIAL-INTELLIGENCE.md)
- [ ] Scoring formulas specification
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema documentation
- [ ] Calibration methodology guide
- [ ] Sales team user guide

### Stakeholder Communication

**For Technical Team:**
- Detailed implementation plan
- API contracts and integration points
- Testing strategy and coverage requirements

**For Sales Team:**
- Scoring system overview (non-technical)
- How to interpret scores
- When to override scoring decisions
- How scoring improves their efficiency

**For Management:**
- ROI projection (time saved, conversion improvement)
- Risk assessment
- Resource requirements
- Success metrics and KPIs

---

## Appendix A: Scoring Dimensions Reference

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `score_contactabilidad` | TINYINT | 0-100 | Contact reachability probability |
| `score_madurez_digital` | TINYINT | 0-100 | Digital presence maturity |
| `score_potencial` | TINYINT | 0-100 | Commercial opportunity value |
| `score_total` | TINYINT | 0-100 | Weighted composite score |
| `nivel_calidad` | ENUM | A/B/C/D | Human-readable classification |
| `validado_tecnicamente` | TINYINT(1) | 0/1 | Technical validation flag |
| `validado_comercialmente` | TINYINT(1) | 0/1 | Commercial validation flag |
| `fecha_scoring` | DATETIME | NULL/timestamp | Last scoring calculation |

---

## Appendix B: Integration Checklist

### Pre-Implementation

- [ ] Phase 2 completed (Auth + Infrastructure)
- [ ] Database backup created
- [ ] Staging environment available
- [ ] Test data prepared

### Implementation

- [ ] SQL migration executed
- [ ] Indexes created and verified
- [ ] scoringFormulas.js implemented
- [ ] scoringService.js implemented
- [ ] scoringController.js implemented
- [ ] scoringMiddleware.js implemented
- [ ] Routes updated with middleware
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests written

### Validation

- [ ] Scoring runs on sample prospects
- [ ] Formula outputs validated manually
- [ ] Middleware blocks invalid prospects
- [ ] Middleware allows valid prospects
- [ ] Query performance measured
- [ ] Score distribution analyzed

### Deployment

- [ ] Code review completed
- [ ] Documentation updated
- [ ] Staging validation passed
- [ ] Production deployment scheduled
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

### Post-Deployment

- [ ] Scoring run on all prospects
- [ ] Sales team trained
- [ ] Campaign run with scoring
- [ ] Metrics collected for 1 week
- [ ] Calibration adjustments made
- [ ] Phase 4 marked complete

---

## Sign-Off

**Phase 4 Status:** 📋 PLANNED (Documentation Complete, Implementation Pending)

**Next Steps:**
1. Review and approve this documentation
2. Schedule Phase 4 implementation (estimated 3-4 days)
3. Prepare staging environment
4. Begin Phase 4.1 (Schema Migration)

**Dependencies:**
- ✅ Phase 2 (Infrastructure) - Completed
- ⏳ Phase 3 (WhatsApp Session) - Planned (can run in parallel)

**Approvals Required:**
- [ ] Technical Lead: Alberto Hilal
- [ ] Sales Manager: TBD
- [ ] Data Quality Review: TBD

---

**Document Version:** 1.0  
**Author:** GitHub Copilot (Claude Sonnet 4.5) + Alberto Hilal  
**Date:** 2026-02-21  
**Status:** Ready for Review
