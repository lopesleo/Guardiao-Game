// Object pool genérico (D18). Reaproveita instâncias em vez de criar/destruir.
// Uso:
//   const pool = new Pool(() => new Projectile(scene));
//   const p = pool.acquire(); ... p.deactivate(); pool.release(p);

export class Pool {
  constructor(factory, initial = 0) {
    this.factory = factory;
    this.available = [];
    this.inUse = new Set();
    for (let i = 0; i < initial; i++) this.available.push(this._make());
  }

  _make() {
    const obj = this.factory();
    obj._pool_active = false;
    return obj;
  }

  acquire() {
    const obj = this.available.pop() ?? this._make();
    obj._pool_active = true;
    this.inUse.add(obj);
    return obj;
  }

  release(obj) {
    if (!obj._pool_active) return;
    obj._pool_active = false;
    this.inUse.delete(obj);
    this.available.push(obj);
  }

  get size() { return this.inUse.size; }

  forEachActive(fn) {
    for (const obj of this.inUse) fn(obj);
  }
}
