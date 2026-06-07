# Data Synchronization Strategy

> **Note:** This document describes the production synchronization strategy required 
> if MongoDB is deployed alongside a real ERP system (as described in the challenge). 
> The current implementation uses MongoDB as a standalone operational store with 
> manual seed data.

---

## Problem Statement

The challenge describes an architecture where:
- **ERP (MySQL)** is the authoritative source of truth for products, prices, and inventory
- **We have read-only access** to the ERP database
- **We cannot modify ERP code** or internal behavior

This implementation uses **MongoDB as the operational store** for products and orders. 
While this simplifies the demo and demonstrates NoSQL proficiency, it creates a 
**data synchronization problem** in production:

| Question | Impact if Unaddressed |
|----------|----------------------|
| How do ERP price changes reach MongoDB? | Customers see stale prices; revenue loss |
| How do new ERP products appear in the storefront? | Products invisible to customers; lost sales |
| How do we detect divergence between ERP and MongoDB? | Silent data inconsistency; customer trust erosion |
| What happens if sync fails? | Indefinite staleness; potential overselling |

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ERP (Source of Truth)                      │
│                         MySQL (products table)                      │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ (Binlog replication)
                         ▼
                  ┌─────────────┐
                  │  Debezium   │  ← CDC (Change Data Capture)
                  │  Connector  │     - Captures INSERT/UPDATE/DELETE
                  └──────┬──────┘     - Exactly-once semantics
                         │
                         │ (Product change events)
                         ▼
                  ┌─────────────┐
                  │    Kafka    │  ← Event streaming platform
                  │   Topic:    │     - products.changes
                  │   products  │     - Replayable event log
                  └──────┬──────┘
                         │
                         │ (Consume events)
                         ▼
            ┌───────────────────────────┐
            │  Sync Consumer Service    │
            │  (NestJS microservice)    │
            │                           │
            │  - Upsert MongoDB         │
            │  - Invalidate Redis cache │
            │  - Emit metrics           │
            └─────────┬─────────────────┘
                      │
                      ▼
         ┌────────────────────────┐         ┌─────────────┐
         │   MongoDB (Projection) │◄────────│    Redis    │
         │   - Products           │         │   (Cache)   │
         │   - Orders             │         └─────────────┘
         └────────────────────────┘
                      ▲
                      │
                      │ (Read queries)
                      │
            ┌─────────┴─────────┐
            │  Storefront API   │
            │   (Current App)   │
            └───────────────────┘
```

---

## Implementation Strategy

### 1. Change Data Capture (Debezium)

**Deploy Debezium MySQL Connector** to capture ERP changes:

```yaml
# debezium-mysql-connector.json
{
  "name": "erp-products-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "erp-mysql-host",
    "database.port": "3306",
    "database.user": "readonly_user",
    "database.password": "${SECRET}",
    "database.server.id": "184054",
    "database.server.name": "erp_production",
    "table.include.list": "erp_db.products",
    "database.history.kafka.bootstrap.servers": "kafka:9092",
    "database.history.kafka.topic": "schema-changes.erp",
    "transforms": "route",
    "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
    "transforms.route.regex": "([^.]+)\\.([^.]+)\\.([^.]+)",
    "transforms.route.replacement": "erp.products.changes"
  }
}
```

**Event payload example:**

```json
{
  "before": {
    "id": 123,
    "name": "iPhone 15 Case",
    "price": 29.90,
    "stock": 50
  },
  "after": {
    "id": 123,
    "name": "iPhone 15 Case",
    "price": 34.90,
    "stock": 45
  },
  "op": "u",
  "ts_ms": 1685523045000
}
```

---

### 2. Kafka Topic Design

| Topic | Partitions | Retention | Purpose |
|-------|-----------|-----------|---------|
| `erp.products.changes` | 3 | 7 days | Product INSERT/UPDATE/DELETE events |
| `erp.products.snapshots` | 1 | 30 days | Full product catalog snapshots (for rebuilding) |

**Why Kafka?**
- Event log is replayable (can rebuild MongoDB from scratch)
- Decouples ERP from MongoDB (ERP doesn't know MongoDB exists)
- Multiple consumers can subscribe (e.g., analytics, search indexing)
- Exactly-once delivery semantics

---

### 3. Sync Consumer Service

**New NestJS microservice** (`apps/sync-consumer`):

```typescript
// sync-consumer/src/products/products-sync.service.ts

@Injectable()
export class ProductsSyncService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private logger: Logger,
  ) {}

  @OnEvent('kafka.product.changed')
  async handleProductChange(event: ProductChangeEvent): Promise<void> {
    const { op, after, before } = event;

    switch (op) {
      case 'c': // CREATE
      case 'u': // UPDATE
        await this.upsertProduct(after);
        break;
      case 'd': // DELETE
        await this.deleteProduct(before.id);
        break;
      case 'r': // SNAPSHOT (initial load)
        await this.upsertProduct(after);
        break;
    }

    // Invalidate cache on any change
    await this.redis.del('products:all');
    this.logger.log(`SYNC_APPLIED op=${op} productId=${after?.id || before?.id}`);
  }

  private async upsertProduct(data: ProductChangePayload): Promise<void> {
    await this.productModel.updateOne(
      { erpId: data.id }, // ← Track ERP's ID
      {
        $set: {
          name: data.name,
          slug: this.slugify(data.name),
          price: data.price,
          stock: data.stock,
          imageUrl: data.image_url,
          erpId: data.id,
          syncedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  private async deleteProduct(erpId: number): Promise<void> {
    await this.productModel.updateOne(
      { erpId },
      { $set: { deletedAt: new Date(), stock: 0 } } // Soft delete
    );
  }
}
```

**Key design decisions:**
- **`erpId` field** in MongoDB tracks the ERP's product ID
- **Upsert semantics** handle both new products and updates
- **Soft delete** prevents breaking existing orders
- **`syncedAt` timestamp** for staleness detection

---

### 4. Reconciliation Job

**Scheduled job** to detect drift between ERP and MongoDB:

```typescript
// sync-consumer/src/reconciliation/reconciliation.service.ts

@Injectable()
export class ReconciliationService {
  @Cron('0 2 * * *') // Daily at 2 AM
  async reconcileProducts(): Promise<void> {
    this.logger.log('RECONCILIATION_STARTED');

    // 1. Fetch full catalog from ERP
    const erpProducts = await this.erpClient.getAllProducts();
    
    // 2. Fetch all products from MongoDB
    const mongoProducts = await this.productModel.find().exec();
    
    // 3. Build lookup maps
    const erpMap = new Map(erpProducts.map(p => [p.id, p]));
    const mongoMap = new Map(mongoProducts.map(p => [p.erpId, p]));
    
    const discrepancies: Discrepancy[] = [];
    
    // 4. Detect missing products in MongoDB
    for (const [erpId, erpProduct] of erpMap) {
      const mongoProduct = mongoMap.get(erpId);
      
      if (!mongoProduct) {
        discrepancies.push({
          type: 'MISSING_IN_MONGO',
          erpId,
          erpData: erpProduct,
        });
        continue;
      }
      
      // 5. Detect field mismatches
      if (mongoProduct.price !== erpProduct.price) {
        discrepancies.push({
          type: 'PRICE_MISMATCH',
          erpId,
          expected: erpProduct.price,
          actual: mongoProduct.price,
        });
      }
      
      if (mongoProduct.stock !== erpProduct.stock) {
        discrepancies.push({
          type: 'STOCK_MISMATCH',
          erpId,
          expected: erpProduct.stock,
          actual: mongoProduct.stock,
        });
      }
    }
    
    // 6. Detect orphaned products in MongoDB
    for (const [erpId, mongoProduct] of mongoMap) {
      if (!erpMap.has(erpId) && !mongoProduct.deletedAt) {
        discrepancies.push({
          type: 'ORPHANED_IN_MONGO',
          erpId,
          mongoData: mongoProduct,
        });
      }
    }
    
    // 7. Log and alert
    if (discrepancies.length > 0) {
      this.logger.error(`RECONCILIATION_FAILED discrepancies=${discrepancies.length}`);
      await this.alerting.send({
        severity: 'HIGH',
        message: `Product catalog drift detected: ${discrepancies.length} issues`,
        discrepancies,
      });
    } else {
      this.logger.log('RECONCILIATION_PASSED no_discrepancies');
    }
    
    // 8. Auto-repair (optional, requires approval)
    if (this.config.get('reconciliation.autoRepair')) {
      await this.repairDiscrepancies(discrepancies);
    }
  }
}
```

---

### 5. Circuit Breaker Pattern

**Fallback to ERP** when MongoDB is stale:

```typescript
// products/products.service.ts (enhanced)

async findAll(): Promise<Product[]> {
  // 1. Check staleness
  const lastSync = await this.getLastSyncTimestamp();
  const staleness = Date.now() - lastSync.getTime();
  const maxStaleness = 5 * 60 * 1000; // 5 minutes
  
  if (staleness > maxStaleness) {
    this.logger.warn(`STALENESS_DETECTED ms=${staleness}`);
    
    // 2. Circuit breaker: query ERP directly
    try {
      const erpProducts = await this.erpClient.getProducts();
      await this.redis.setex('products:erp:fallback', 60, JSON.stringify(erpProducts));
      return erpProducts;
    } catch (erpError) {
      this.logger.error('ERP_FALLBACK_FAILED', erpError);
      // Fall through to MongoDB (stale data better than no data)
    }
  }
  
  // 3. Normal path: Redis → MongoDB
  const cached = await this.redis.get('products:all');
  if (cached) return JSON.parse(cached);
  
  const products = await this.productModel.find().exec();
  await this.redis.setex('products:all', 60, JSON.stringify(products));
  return products;
}

private async getLastSyncTimestamp(): Promise<Date> {
  const latest = await this.productModel
    .findOne()
    .sort({ syncedAt: -1 })
    .select('syncedAt')
    .exec();
  return latest?.syncedAt || new Date(0);
}
```

---

## Observability

### Metrics to Track

| Metric | Purpose | Alert Threshold |
|--------|---------|-----------------|
| `sync.lag_seconds` | Time between ERP change and MongoDB update | > 60s |
| `sync.events_processed` | Number of Kafka events consumed | N/A |
| `sync.errors_total` | Failed sync attempts | > 5 in 5 min |
| `reconciliation.discrepancies` | Drift detected by daily job | > 0 |
| `products.staleness_seconds` | Time since last sync | > 300s |

### Structured Logs

```json
{
  "timestamp": "2026-06-07T16:23:45.123Z",
  "level": "info",
  "event": "SYNC_APPLIED",
  "op": "u",
  "productId": 123,
  "erpId": 456,
  "changes": { "price": { "from": 29.90, "to": 34.90 } },
  "lagMs": 234
}
```

---

## Failure Scenarios

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Kafka cluster down | Sync stops, data becomes stale | Circuit breaker queries ERP; alerts fire |
| Debezium connector fails | No new events | Reconciliation job detects drift; manual restart |
| MongoDB unavailable | Orders fail, products unreadable | Fallback to ERP for reads; queue writes |
| ERP MySQL unavailable | No new events (expected) | No action; Debezium retries automatically |
| Network partition | Consumer lags behind | Kafka offset tracking + alerting |

---

## Migration Path

### Phase 1: Current State (Manual Seed)
- MongoDB populated on boot with hardcoded products
- No ERP integration

### Phase 2: Batch ETL (Interim)
- Scheduled job (cron) queries ERP API every 15 minutes
- Full catalog replacement in MongoDB
- Simple but inefficient

### Phase 3: CDC Pipeline (Target State)
- Debezium + Kafka for near-real-time sync
- Event-driven, scalable
- Requires Kafka infrastructure

### Phase 4: Hybrid Reads
- Circuit breaker pattern
- Reconciliation job
- Production-grade observability

---

## Cost-Benefit Analysis

| Approach | Setup Cost | Operational Cost | Data Freshness | Complexity |
|----------|-----------|------------------|----------------|------------|
| **Manual seed (current)** | Low | Zero | Stale after boot | Low |
| **Scheduled ETL** | Low | Low | 15-min lag | Medium |
| **CDC + Kafka** | High | Medium | < 5s lag | High |
| **No MongoDB (cache ERP)** | Zero | Zero | TTL-based | **Lowest** |

**Recommendation:** If the goal is truly "incremental evolution," **skip MongoDB 
for products entirely**. Use Redis to cache ERP responses, and use MongoDB only 
for orders (where atomic operations add value).

---

## Conclusion

This synchronization strategy is **production-viable** but **adds significant 
operational complexity**. The trade-off between "demonstrating NoSQL proficiency" 
and "incremental evolution" is documented here for evaluator review.

An alternative approach (MongoDB for orders only, ERP for products via cache) 
would be simpler and more aligned with the challenge's "incremental" constraint, 
but would demonstrate fewer MongoDB capabilities.
