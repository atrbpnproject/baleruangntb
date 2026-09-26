var martinez = (function (exports) {
  'use strict';

  function DEFAULT_COMPARE (a, b) { return a > b ? 1 : a < b ? -1 : 0; }

  class SplayTree {

    constructor(compare = DEFAULT_COMPARE, noDuplicates = false) {
      this._compare = compare;
      this._root = null;
      this._size = 0;
      this._noDuplicates = !!noDuplicates;
    }


    rotateLeft(x) {
      var y = x.right;
      if (y) {
        x.right = y.left;
        if (y.left) y.left.parent = x;
        y.parent = x.parent;
      }

      if (!x.parent)                this._root = y;
      else if (x === x.parent.left) x.parent.left = y;
      else                          x.parent.right = y;
      if (y) y.left = x;
      x.parent = y;
    }


    rotateRight(x) {
      var y = x.left;
      if (y) {
        x.left = y.right;
        if (y.right) y.right.parent = x;
        y.parent = x.parent;
      }

      if (!x.parent)               this._root = y;
      else if(x === x.parent.left) x.parent.left = y;
      else                         x.parent.right = y;
      if (y) y.right = x;
      x.parent = y;
    }


    _splay(x) {
      while (x.parent) {
        var p = x.parent;
        if (!p.parent) {
          if (p.left === x) this.rotateRight(p);
          else              this.rotateLeft(p);
        } else if (p.left === x && p.parent.left === p) {
          this.rotateRight(p.parent);
          this.rotateRight(p);
        } else if (p.right === x && p.parent.right === p) {
          this.rotateLeft(p.parent);
          this.rotateLeft(p);
        } else if (p.left === x && p.parent.right === p) {
          this.rotateRight(p);
          this.rotateLeft(p);
        } else {
          this.rotateLeft(p);
          this.rotateRight(p);
        }
      }
    }


    splay(x) {
      var p, gp, ggp, l, r;

      while (x.parent) {
        p = x.parent;
        gp = p.parent;

        if (gp && gp.parent) {
          ggp = gp.parent;
          if (ggp.left === gp) ggp.left  = x;
          else                 ggp.right = x;
          x.parent = ggp;
        } else {
          x.parent = null;
          this._root = x;
        }

        l = x.left; r = x.right;

        if (x === p.left) { // left
          if (gp) {
            if (gp.left === p) {
              /* zig-zig */
              if (p.right) {
                gp.left = p.right;
                gp.left.parent = gp;
              } else gp.left = null;

              p.right   = gp;
              gp.parent = p;
            } else {
              /* zig-zag */
              if (l) {
                gp.right = l;
                l.parent = gp;
              } else gp.right = null;

              x.left    = gp;
              gp.parent = x;
            }
          }
          if (r) {
            p.left = r;
            r.parent = p;
          } else p.left = null;

          x.right  = p;
          p.parent = x;
        } else { // right
          if (gp) {
            if (gp.right === p) {
              /* zig-zig */
              if (p.left) {
                gp.right = p.left;
                gp.right.parent = gp;
              } else gp.right = null;

              p.left = gp;
              gp.parent = p;
            } else {
              /* zig-zag */
              if (r) {
                gp.left = r;
                r.parent = gp;
              } else gp.left = null;

              x.right   = gp;
              gp.parent = x;
            }
          }
          if (l) {
            p.right = l;
            l.parent = p;
          } else p.right = null;

          x.left   = p;
          p.parent = x;
        }
      }
    }


    replace(u, v) {
      if (!u.parent) this._root = v;
      else if (u === u.parent.left) u.parent.left = v;
      else u.parent.right = v;
      if (v) v.parent = u.parent;
    }


    minNode(u = this._root) {
      if (u) while (u.left) u = u.left;
      return u;
    }


    maxNode(u = this._root) {
      if (u) while (u.right) u = u.right;
      return u;
    }


    insert(key, data) {
      var z = this._root;
      var p = null;
      var comp = this._compare;
      var cmp;

      if (this._noDuplicates) {
        while (z) {
          p = z;
          cmp = comp(z.key, key);
          if (cmp === 0) return;
          else if (comp(z.key, key) < 0) z = z.right;
          else z = z.left;
        }
      } else {
        while (z) {
          p = z;
          if (comp(z.key, key) < 0) z = z.right;
          else z = z.left;
        }
      }

      z = { key, data, left: null, right: null, parent: p };

      if (!p)                          this._root = z;
      else if (comp(p.key, z.key) < 0) p.right = z;
      else                             p.left  = z;

      this.splay(z);
      this._size++;
      return z;
    }


    find (key) {
      var z    = this._root;
      var comp = this._compare;
      while (z) {
        var cmp = comp(z.key, key);
        if      (cmp < 0) z = z.right;
        else if (cmp > 0) z = z.left;
        else              return z;
      }
      return null;
    }

    /**
     * Whether the tree contains a node with the given key
     * @param  {Key} key
     * @return {boolean} true/false
     */
    contains (key) {
      var node       = this._root;
      var comparator = this._compare;
      while (node)  {
        var cmp = comparator(key, node.key);
        if      (cmp === 0) return true;
        else if (cmp < 0)   node = node.left;
        else                node = node.right;
      }

      return false;
    }


    remove (key) {
      var z = this.find(key);

      if (!z) return false;

      this.splay(z);

      if (!z.left) this.replace(z, z.right);
      else if (!z.right) this.replace(z, z.left);
      else {
        var y = this.minNode(z.right);
        if (y.parent !== z) {
          this.replace(y, y.right);
          y.right = z.right;
          y.right.parent = y;
        }
        this.replace(z, y);
        y.left = z.left;
        y.left.parent = y;
      }

      this._size--;
      return true;
    }


    removeNode(z) {
      if (!z) return false;

      this.splay(z);

      if (!z.left) this.replace(z, z.right);
      else if (!z.right) this.replace(z, z.left);
      else {
        var y = this.minNode(z.right);
        if (y.parent !== z) {
          this.replace(y, y.right);
          y.right = z.right;
          y.right.parent = y;
        }
        this.replace(z, y);
        y.left = z.left;
        y.left.parent = y;
      }

      this._size--;
      return true;
    }


    erase (key) {
      var z = this.find(key);
      if (!z) return;

      this.splay(z);

      var s = z.left;
      var t = z.right;

      var sMax = null;
      if (s) {
        s.parent = null;
        sMax = this.maxNode(s);
        this.splay(sMax);
        this._root = sMax;
      }
      if (t) {
        if (s) sMax.right = t;
        else   this._root = t;
        t.parent = sMax;
      }

      this._size--;
    }

    /**
     * Removes and returns the node with smallest key
     * @return {?Node}
     */
    pop () {
      var node = this._root, returnValue = null;
      if (node) {
        while (node.left) node = node.left;
        returnValue = { key: node.key, data: node.data };
        this.remove(node.key);
      }
      return returnValue;
    }


    /* eslint-disable class-methods-use-this */

    /**
     * Successor node
     * @param  {Node} node
     * @return {?Node}
     */
    next (node) {
      var successor = node;
      if (successor) {
        if (successor.right) {
          successor = successor.right;
          while (successor && successor.left) successor = successor.left;
        } else {
          successor = node.parent;
          while (successor && successor.right === node) {
            node = successor; successor = successor.parent;
          }
        }
      }
      return successor;
    }


    /**
     * Predecessor node
     * @param  {Node} node
     * @return {?Node}
     */
    prev (node) {
      var predecessor = node;
      if (predecessor) {
        if (predecessor.left) {
          predecessor = predecessor.left;
          while (predecessor && predecessor.right) predecessor = predecessor.right;
        } else {
          predecessor = node.parent;
          while (predecessor && predecessor.left === node) {
            node = predecessor;
            predecessor = predecessor.parent;
          }
        }
      }
      return predecessor;
    }
    /* eslint-enable class-methods-use-this */


    /**
     * @param  {forEachCallback} callback
     * @return {SplayTree}
     */
    forEach(callback) {
      var current = this._root;
      var s = [], done = false, i = 0;

      while (!done) {
        // Reach the left most Node of the current Node
        if (current) {
          // Place pointer to a tree node on the stack
          // before traversing the node's left subtree
          s.push(current);
          current = current.left;
        } else {
          // BackTrack from the empty subtree and visit the Node
          // at the top of the stack; however, if the stack is
          // empty you are done
          if (s.length > 0) {
            current = s.pop();
            callback(current, i++);

            // We have visited the node and its left
            // subtree. Now, it's right subtree's turn
            current = current.right;
          } else done = true;
        }
      }
      return this;
    }


    /**
     * Walk key range from `low` to `high`. Stops if `fn` returns a value.
     * @param  {Key}      low
     * @param  {Key}      high
     * @param  {Function} fn
     * @param  {*?}       ctx
     * @return {SplayTree}
     */
    range(low, high, fn, ctx) {
      const Q = [];
      const compare = this._compare;
      let node = this._root, cmp;

      while (Q.length !== 0 || node) {
        if (node) {
          Q.push(node);
          node = node.left;
        } else {
          node = Q.pop();
          cmp = compare(node.key, high);
          if (cmp > 0) {
            break;
          } else if (compare(node.key, low) >= 0) {
            if (fn.call(ctx, node)) return this; // stop if smth is returned
          }
          node = node.right;
        }
      }
      return this;
    }

    /**
     * Returns all keys in order
     * @return {Array<Key>}
     */
    keys () {
      var current = this._root;
      var s = [], r = [], done = false;

      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            r.push(current.key);
            current = current.right;
          } else done = true;
        }
      }
      return r;
    }


    /**
     * Returns `data` fields of all nodes in order.
     * @return {Array<Value>}
     */
    values () {
      var current = this._root;
      var s = [], r = [], done = false;

      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            r.push(current.data);
            current = current.right;
          } else done = true;
        }
      }
      return r;
    }


    /**
     * Returns node at given index
     * @param  {number} index
     * @return {?Node}
     */
    at (index) {
      // removed after a consideration, more misleading than useful
      // index = index % this.size;
      // if (index < 0) index = this.size - index;

      var current = this._root;
      var s = [], done = false, i = 0;

      while (!done) {
        if (current) {
          s.push(current);
          current = current.left;
        } else {
          if (s.length > 0) {
            current = s.pop();
            if (i === index) return current;
            i++;
            current = current.right;
          } else done = true;
        }
      }
      return null;
    }

    /**
     * Bulk-load items. Both array have to be same size
     * @param  {Array<Key>}    keys
     * @param  {Array<Value>}  [values]
     * @param  {Boolean}       [presort=false] Pre-sort keys and values, using
     *                                         tree's comparator. Sorting is done
     *                                         in-place
     * @return {AVLTree}
     */
    load(keys = [], values = [], presort = false) {
      if (this._size !== 0) throw new Error('bulk-load: tree is not empty');
      const size = keys.length;
      if (presort) sort(keys, values, 0, size - 1, this._compare);
      this._root = loadRecursive(null, keys, values, 0, size);
      this._size = size;
      return this;
    }


    min() {
      var node = this.minNode(this._root);
      if (node) return node.key;
      else      return null;
    }


    max() {
      var node = this.maxNode(this._root);
      if (node) return node.key;
      else      return null;
    }

    isEmpty() { return this._root === null; }
    get size() { return this._size; }


    /**
     * Create a tree and load it with items
     * @param  {Array<Key>}          keys
     * @param  {Array<Value>?}        [values]

     * @param  {Function?}            [comparator]
     * @param  {Boolean?}             [presort=false] Pre-sort keys and values, using
     *                                               tree's comparator. Sorting is done
     *                                               in-place
     * @param  {Boolean?}             [noDuplicates=false]   Allow duplicates
     * @return {SplayTree}
     */
    static createTree(keys, values, comparator, presort, noDuplicates) {
      return new SplayTree(comparator, noDuplicates).load(keys, values, presort);
    }
  }


  function loadRecursive (parent, keys, values, start, end) {
    const size = end - start;
    if (size > 0) {
      const middle = start + Math.floor(size / 2);
      const key    = keys[middle];
      const data   = values[middle];
      const node   = { key, data, parent };
      node.left    = loadRecursive(node, keys, values, start, middle);
      node.right   = loadRecursive(node, keys, values, middle + 1, end);
      return node;
    }
    return null;
  }


  function sort(keys, values, left, right, compare) {
    if (left >= right) return;

    const pivot = keys[(left + right) >> 1];
    let i = left - 1;
    let j = right + 1;

    while (true) {
      do i++; while (compare(keys[i], pivot) < 0);
      do j--; while (compare(keys[j], pivot) > 0);
      if (i >= j) break;

      let tmp = keys[i];
      keys[i] = keys[j];
      keys[j] = tmp;

      tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }

    sort(keys, values,  left,     j, compare);
    sort(keys, values, j + 1, right, compare);
  }

  const epsilon = 1.1102230246251565e-16;
  const splitter = 134217729;
  const resulterrbound = (3 + 8 * epsilon) * epsilon;

  // fast_expansion_sum_zeroelim routine from oritinal code
  function sum(elen, e, flen, f, h) {
      let Q, Qnew, hh, bvirt;
      let enow = e[0];
      let fnow = f[0];
      let eindex = 0;
      let findex = 0;
      if ((fnow > enow) === (fnow > -enow)) {
          Q = enow;
          enow = e[++eindex];
      } else {
          Q = fnow;
          fnow = f[++findex];
      }
      let hindex = 0;
      if (eindex < elen && findex < flen) {
          if ((fnow > enow) === (fnow > -enow)) {
              Qnew = enow + Q;
              hh = Q - (Qnew - enow);
              enow = e[++eindex];
          } else {
              Qnew = fnow + Q;
              hh = Q - (Qnew - fnow);
              fnow = f[++findex];
          }
          Q = Qnew;
          if (hh !== 0) {
              h[hindex++] = hh;
          }
          while (eindex < elen && findex < flen) {
              if ((fnow > enow) === (fnow > -enow)) {
                  Qnew = Q + enow;
                  bvirt = Qnew - Q;
                  hh = Q - (Qnew - bvirt) + (enow - bvirt);
                  enow = e[++eindex];
              } else {
                  Qnew = Q + fnow;
                  bvirt = Qnew - Q;
                  hh = Q - (Qnew - bvirt) + (fnow - bvirt);
                  fnow = f[++findex];
              }
              Q = Qnew;
              if (hh !== 0) {
                  h[hindex++] = hh;
              }
          }
      }
      while (eindex < elen) {
          Qnew = Q + enow;
          bvirt = Qnew - Q;
          hh = Q - (Qnew - bvirt) + (enow - bvirt);
          enow = e[++eindex];
          Q = Qnew;
          if (hh !== 0) {
              h[hindex++] = hh;
          }
      }
      while (findex < flen) {
          Qnew = Q + fnow;
          bvirt = Qnew - Q;
          hh = Q - (Qnew - bvirt) + (fnow - bvirt);
          fnow = f[++findex];
          Q = Qnew;
          if (hh !== 0) {
              h[hindex++] = hh;
          }
      }
      if (Q !== 0 || hindex === 0) {
          h[hindex++] = Q;
      }
      return hindex;
  }

  function estimate(elen, e) {
      let Q = e[0];
      for (let i = 1; i < elen; i++) Q += e[i];
      return Q;
  }

  function vec(n) {
      return new Float64Array(n);
  }

  const ccwerrboundA = (3 + 16 * epsilon) * epsilon;
  const ccwerrboundB = (2 + 12 * epsilon) * epsilon;
  const ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;

  const B = vec(4);
  const C1 = vec(8);
  const C2 = vec(12);
  const D$1 = vec(16);
  const u = vec(4);

  function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
      let acxtail, acytail, bcxtail, bcytail;
      let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;

      const acx = ax - cx;
      const bcx = bx - cx;
      const acy = ay - cy;
      const bcy = by - cy;

      s1 = acx * bcy;
      c = splitter * acx;
      ahi = c - (c - acx);
      alo = acx - ahi;
      c = splitter * bcy;
      bhi = c - (c - bcy);
      blo = bcy - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acy * bcx;
      c = splitter * acy;
      ahi = c - (c - acy);
      alo = acy - ahi;
      c = splitter * bcx;
      bhi = c - (c - bcx);
      blo = bcx - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      B[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      B[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      B[2] = _j - (u3 - bvirt) + (_i - bvirt);
      B[3] = u3;

      let det = estimate(4, B);
      let errbound = ccwerrboundB * detsum;
      if (det >= errbound || -det >= errbound) {
          return det;
      }

      bvirt = ax - acx;
      acxtail = ax - (acx + bvirt) + (bvirt - cx);
      bvirt = bx - bcx;
      bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
      bvirt = ay - acy;
      acytail = ay - (acy + bvirt) + (bvirt - cy);
      bvirt = by - bcy;
      bcytail = by - (bcy + bvirt) + (bvirt - cy);

      if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
          return det;
      }

      errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
      det += (acx * bcytail + bcy * acxtail) - (acy * bcxtail + bcx * acytail);
      if (det >= errbound || -det >= errbound) return det;

      s1 = acxtail * bcy;
      c = splitter * acxtail;
      ahi = c - (c - acxtail);
      alo = acxtail - ahi;
      c = splitter * bcy;
      bhi = c - (c - bcy);
      blo = bcy - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acytail * bcx;
      c = splitter * acytail;
      ahi = c - (c - acytail);
      alo = acytail - ahi;
      c = splitter * bcx;
      bhi = c - (c - bcx);
      blo = bcx - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const C1len = sum(4, B, 4, u, C1);

      s1 = acx * bcytail;
      c = splitter * acx;
      ahi = c - (c - acx);
      alo = acx - ahi;
      c = splitter * bcytail;
      bhi = c - (c - bcytail);
      blo = bcytail - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acy * bcxtail;
      c = splitter * acy;
      ahi = c - (c - acy);
      alo = acy - ahi;
      c = splitter * bcxtail;
      bhi = c - (c - bcxtail);
      blo = bcxtail - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const C2len = sum(C1len, C1, 4, u, C2);

      s1 = acxtail * bcytail;
      c = splitter * acxtail;
      ahi = c - (c - acxtail);
      alo = acxtail - ahi;
      c = splitter * bcytail;
      bhi = c - (c - bcytail);
      blo = bcytail - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acytail * bcxtail;
      c = splitter * acytail;
      ahi = c - (c - acytail);
      alo = acytail - ahi;
      c = splitter * bcxtail;
      bhi = c - (c - bcxtail);
      blo = bcxtail - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const Dlen = sum(C2len, C2, 4, u, D$1);

      return D$1[Dlen - 1];
  }

  function orient2d(ax, ay, bx, by, cx, cy) {
      const detleft = (ay - cy) * (bx - cx);
      const detright = (ax - cx) * (by - cy);
      const det = detleft - detright;

      if (detleft === 0 || detright === 0 || (detleft > 0) !== (detright > 0)) return det;

      const detsum = Math.abs(detleft + detright);
      if (Math.abs(det) >= ccwerrboundA * detsum) return det;

      return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
  }

  class TinyQueue {
      constructor(data = [], compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
          this.data = data;
          this.length = this.data.length;
          this.compare = compare;

          if (this.length > 0) {
              for (let i = (this.length >> 1) - 1; i >= 0; i--) this._down(i);
          }
      }

      push(item) {
          this.data.push(item);
          this._up(this.length++);
      }

      pop() {
          if (this.length === 0) return undefined;

          const top = this.data[0];
          const bottom = this.data.pop();

          if (--this.length > 0) {
              this.data[0] = bottom;
              this._down(0);
          }

          return top;
      }

      peek() {
          return this.data[0];
      }

      _up(pos) {
          const {data, compare} = this;
          const item = data[pos];

          while (pos > 0) {
              const parent = (pos - 1) >> 1;
              const current = data[parent];
              if (compare(item, current) >= 0) break;
              data[pos] = current;
              pos = parent;
          }

          data[pos] = item;
      }

      _down(pos) {
          const {data, compare} = this;
          const halfLength = this.length >> 1;
          const item = data[pos];

          while (pos < halfLength) {
              let bestChild = (pos << 1) + 1; // initially it is the left child
              const right = bestChild + 1;

              if (right < this.length && compare(data[right], data[bestChild]) < 0) {
                  bestChild = right;
              }
              if (compare(data[bestChild], item) >= 0) break;

              data[pos] = data[bestChild];
              pos = bestChild;
          }

          data[pos] = item;
      }
  }

  const U = 0, _ = 1, z = 2, G = 3, R = 0, y = 1, g = 2, T = 3;
  function P(n, t, e) {
    t === null ? (n.inOut = false, n.otherInOut = true) : (n.isSubject === t.isSubject ? (n.inOut = !t.inOut, n.otherInOut = t.otherInOut) : (n.inOut = !t.otherInOut, n.otherInOut = t.isVertical() ? !t.inOut : t.inOut), t && (n.prevInResult = !F(t, e) || t.isVertical() ? t.prevInResult : t)), F(n, e) ? n.resultTransition = J(n, e) : n.resultTransition = 0;
  }
  function F(n, t) {
    switch (n.type) {
      case U:
        switch (t) {
          case R:
            return !n.otherInOut;
          case y:
            return n.otherInOut;
          case g:
            return n.isSubject && n.otherInOut || !n.isSubject && !n.otherInOut;
          case T:
            return true;
        }
        break;
      case z:
        return t === R || t === y;
      case G:
        return t === g;
      case _:
        return false;
    }
    return false;
  }
  function J(n, t) {
    let e = !n.inOut, i = !n.otherInOut, o;
    switch (t) {
      case R:
        o = e && i;
        break;
      case y:
        o = e || i;
        break;
      case T:
        o = e !== i;
        break;
      case g:
        n.isSubject ? o = e && !i : o = i && !e;
        break;
    }
    return o ? 1 : -1;
  }
  class S {
    /**
     * Sweepline event
     *
     * @class {SweepEvent}
     * @param {Position}        point
     * @param {boolean}         left
     * @param {SweepEvent=}     otherEvent
     * @param {boolean}         isSubject
     * @param {EdgeType}        edgeType
     */
    constructor(t, e, i, o, r) {
      this.left = e, this.point = t, this.otherEvent = i, this.isSubject = o ?? false, this.type = r || U, this.inOut = false, this.otherInOut = false, this.prevInResult = null, this.resultTransition = 0, this.otherPos = -1, this.outputContourId = -1, this.isExteriorRing = true;
    }
    /**
     * @param  {Position}  p
     * @return {boolean}
     */
    isBelow(t) {
      const e = this.point, i = this.otherEvent.point;
      return this.left ? (e[0] - t[0]) * (i[1] - t[1]) - (i[0] - t[0]) * (e[1] - t[1]) > 0 : (i[0] - t[0]) * (e[1] - t[1]) - (e[0] - t[0]) * (i[1] - t[1]) > 0;
    }
    /**
     * @param  {Position}  p
     * @return {boolean}
     */
    isAbove(t) {
      return !this.isBelow(t);
    }
    /**
     * @return {boolean}
     */
    isVertical() {
      return this.point[0] === this.otherEvent.point[0];
    }
    /**
     * Does event belong to result?
     * @return {boolean}
     */
    get inResult() {
      return this.resultTransition !== 0;
    }
    clone() {
      const t = new S(
        this.point,
        this.left,
        this.otherEvent,
        this.isSubject,
        this.type
      );
      return t.contourId = this.contourId, t.resultTransition = this.resultTransition, t.prevInResult = this.prevInResult, t.isExteriorRing = this.isExteriorRing, t.inOut = this.inOut, t.otherInOut = this.otherInOut, t;
    }
  }
  function v(n, t) {
    return n[0] === t[0] ? n[1] === t[1] : false;
  }
  function A(n, t, e) {
    const i = orient2d(n[0], n[1], t[0], t[1], e[0], e[1]);
    return i > 0 ? -1 : i < 0 ? 1 : 0;
  }
  function w(n, t) {
    const e = n.point, i = t.point;
    return e[0] > i[0] ? 1 : e[0] < i[0] ? -1 : e[1] !== i[1] ? e[1] > i[1] ? 1 : -1 : W(n, t, e);
  }
  function W(n, t, e, i) {
    return n.left !== t.left ? n.left ? 1 : -1 : A(e, n.otherEvent.point, t.otherEvent.point) !== 0 ? n.isBelow(t.otherEvent.point) ? -1 : 1 : !n.isSubject && t.isSubject ? 1 : -1;
  }
  function m(n, t, e) {
    const i = new S(t, false, n, n.isSubject), o = new S(t, true, n.otherEvent, n.isSubject);
    return v(n.point, n.otherEvent.point) && console.warn("what is that, a collapsed segment?", n), i.contourId = o.contourId = n.contourId, w(o, n.otherEvent) > 0 && (n.otherEvent.left = true, o.left = false), n.otherEvent.otherEvent = o, n.otherEvent = i, e.push(o), e.push(i), e;
  }
  function k(n, t) {
    return n[0] * t[1] - n[1] * t[0];
  }
  function M(n, t) {
    return n[0] * t[0] + n[1] * t[1];
  }
  function Z(n, t, e, i, o) {
    const r = [t[0] - n[0], t[1] - n[1]], s = [i[0] - e[0], i[1] - e[1]];
    function l(d, O, B) {
      return [
        d[0] + O * B[0],
        d[1] + O * B[1]
      ];
    }
    const c = [e[0] - n[0], e[1] - n[1]];
    let u = k(r, s), f = u * u;
    const p = M(r, r);
    if (f > 0) {
      const d = k(c, s) / u;
      if (d < 0 || d > 1)
        return null;
      const O = k(c, r) / u;
      return O < 0 || O > 1 ? null : d === 0 || d === 1 ? [l(n, d, r)] : O === 0 || O === 1 ? [l(e, O, s)] : [l(n, d, r)];
    }
    if (u = k(c, r), f = u * u, f > 0)
      return null;
    const h = M(r, c) / p, E = h + M(r, s) / p, a = Math.min(h, E), I = Math.max(h, E);
    return a <= 1 && I >= 0 ? a === 1 ? [l(n, a > 0 ? a : 0, r)] : I === 0 ? [l(n, I < 1 ? I : 1, r)] : [
      l(n, a > 0 ? a : 0, r),
      l(n, I < 1 ? I : 1, r)
    ] : null;
  }
  function x(n, t, e) {
    const i = Z(
      n.point,
      n.otherEvent.point,
      t.point,
      t.otherEvent.point
    ), o = i ? i.length : 0;
    if (o === 0 || o === 1 && (v(n.point, t.point) || v(n.otherEvent.point, t.otherEvent.point)) || o === 2 && n.isSubject === t.isSubject)
      return 0;
    if (o === 1)
      return !v(n.point, i[0]) && !v(n.otherEvent.point, i[0]) && m(n, i[0], e), !v(t.point, i[0]) && !v(t.otherEvent.point, i[0]) && m(t, i[0], e), 1;
    const r = [];
    let s = false, l = false;
    return v(n.point, t.point) ? s = true : w(n, t) === 1 ? r.push(t, n) : r.push(n, t), v(n.otherEvent.point, t.otherEvent.point) ? l = true : w(n.otherEvent, t.otherEvent) === 1 ? r.push(t.otherEvent, n.otherEvent) : r.push(n.otherEvent, t.otherEvent), s && l || s ? (t.type = _, n.type = t.inOut === n.inOut ? z : G, s && !l && m(r[1].otherEvent, r[0].point, e), 2) : l ? (m(r[0], r[1].point, e), 3) : r[0] !== r[3].otherEvent ? (m(r[0], r[1].point, e), m(r[1], r[2].point, e), 3) : (m(r[0], r[1].point, e), m(r[3].otherEvent, r[2].point, e), 3);
  }
  function $(n, t) {
    if (n === t) return 0;
    if (A(n.point, n.otherEvent.point, t.point) !== 0 || A(n.point, n.otherEvent.point, t.otherEvent.point) !== 0)
      return v(n.point, t.point) ? n.isBelow(t.otherEvent.point) ? -1 : 1 : n.point[0] === t.point[0] ? n.point[1] < t.point[1] ? -1 : 1 : w(n, t) === 1 ? t.isAbove(n.point) ? -1 : 1 : n.isBelow(t.point) ? -1 : 1;
    if (n.isSubject === t.isSubject) {
      let e = n.point, i = t.point;
      if (e[0] === i[0] && e[1] === i[1])
        return e = n.otherEvent.point, i = t.otherEvent.point, e[0] === i[0] && e[1] === i[1] ? 0 : (n.contourId ?? 0) > (t.contourId ?? 0) ? 1 : -1;
    } else
      return n.isSubject ? -1 : 1;
    return w(n, t) === 1 ? 1 : -1;
  }
  function Q(n, t, e, i, o, r) {
    const s = new SplayTree($), l = [], c = Math.min(i[2], o[2]);
    let u, f, p;
    for (; n.length !== 0; ) {
      let h = n.pop();
      if (l.push(h), r === R && h.point[0] > c || r === g && h.point[0] > i[2])
        break;
      if (h.left) {
        f = u = s.insert(h), p = s.minNode(), u !== p ? u = s.prev(u) : u = null, f = s.next(f);
        const E = u ? u.key : null;
        let a;
        if (P(h, E, r), f && x(h, f.key, n) === 2 && (P(h, E, r), P(f.key, h, r)), u && x(u.key, h, n) === 2) {
          let I = u;
          I !== p ? I = s.prev(I) : I = null, a = I ? I.key : null, P(E, a, r), P(h, E, r);
        }
      } else
        h = h.otherEvent, f = u = s.find(h), u && f && (u !== p ? u = s.prev(u) : u = null, f = s.next(f), s.remove(h), f && u && x(u.key, f.key, n));
    }
    return l;
  }
  class H {
    /**
     * Contour
     *
     * @class {Contour}
     */
    constructor() {
      this.points = [], this.holeIds = [], this.holeOf = null, this.depth = null;
    }
    isExterior() {
      return this.holeOf == null;
    }
  }
  function b(n) {
    let t, e, i, o, r;
    const s = [];
    for (e = 0, i = n.length; e < i; e++)
      t = n[e], (t.left && t.inResult || !t.left && t.otherEvent.inResult) && s.push(t);
    let l = false;
    for (; !l; )
      for (l = true, e = 0, i = s.length; e < i; e++)
        e + 1 < i && w(s[e], s[e + 1]) === 1 && (o = s[e], s[e] = s[e + 1], s[e + 1] = o, l = false);
    for (e = 0, i = s.length; e < i; e++)
      t = s[e], t.otherPos = e;
    for (e = 0, i = s.length; e < i; e++)
      t = s[e], t.left || (r = t.otherPos, t.otherPos = t.otherEvent.otherPos, t.otherEvent.otherPos = r);
    return s;
  }
  function q(n, t, e, i) {
    let o = n + 1, r = t[n].point, s;
    const l = t.length;
    for (o < l && (s = t[o].point); o < l && s[0] === r[0] && s[1] === r[1]; ) {
      if (e[o])
        o++;
      else
        return o;
      o < l && (s = t[o].point);
    }
    for (o = n - 1; e[o] && o > i; )
      o--;
    return o;
  }
  function tt(n, t, e) {
    const i = new H();
    if (n.prevInResult != null) {
      const o = n.prevInResult, r = o.outputContourId;
      if (o.resultTransition > 0) {
        const l = t[r];
        if (l.holeOf != null) {
          const c = l.holeOf;
          t[c].holeIds.push(e), i.holeOf = c, i.depth = t[r].depth;
        } else
          t[r].holeIds.push(e), i.holeOf = r, i.depth = t[r].depth + 1;
      } else
        i.holeOf = null, i.depth = t[r].depth;
    } else
      i.holeOf = null, i.depth = 0;
    return i;
  }
  function nt(n) {
    let t, e;
    const i = b(n), o = {}, r = [];
    for (t = 0, e = i.length; t < e; t++) {
      if (o[t])
        continue;
      const s = r.length, l = tt(i[t], r, s), c = (h) => {
        o[h] = true, h < i.length && i[h] && (i[h].outputContourId = s);
      };
      let u = t, f = t;
      const p = i[t].point;
      for (l.points.push(p); c(u), u = i[u].otherPos, c(u), l.points.push(i[u].point), u = q(u, i, o, f), !(u == f || u >= i.length || !i[u]); )
        ;
      r.push(l);
    }
    return r;
  }
  const L = Math.max, V = Math.min;
  let N = 0;
  function D(n, t, e, i, o, r) {
    let s, l, c, u, f, p;
    for (s = 0, l = n.length - 1; s < l; s++) {
      if (c = n[s], u = n[s + 1], f = new S(c, false, void 0, t), p = new S(u, false, f, t), f.otherEvent = p, c[0] === u[0] && c[1] === u[1])
        continue;
      f.contourId = p.contourId = e, r || (f.isExteriorRing = false, p.isExteriorRing = false), w(f, p) > 0 ? p.left = true : f.left = true;
      const h = c[0], E = c[1];
      o[0] = V(o[0], h), o[1] = V(o[1], E), o[2] = L(o[2], h), o[3] = L(o[3], E), i.push(f), i.push(p);
    }
  }
  function et(n, t, e, i, o) {
    const r = new TinyQueue(void 0, w);
    let s, l, c, u, f, p;
    for (c = 0, u = n.length; c < u; c++)
      for (s = n[c], f = 0, p = s.length; f < p; f++)
        l = f === 0, l && N++, D(
          s[f],
          true,
          N,
          r,
          e,
          l
        );
    for (c = 0, u = t.length; c < u; c++)
      for (s = t[c], f = 0, p = s.length; f < p; f++)
        l = f === 0, o === g && (l = false), l && N++, D(
          s[f],
          false,
          N,
          r,
          i,
          l
        );
    return r;
  }
  const C = [];
  function it(n, t, e) {
    let i = null;
    return n.length * t.length === 0 && (e === R ? i = C : e === g ? i = n : (e === y || e === T) && (i = n.length === 0 ? t : n)), i;
  }
  function rt(n, t, e, i, o) {
    let r = null;
    return (e[0] > i[2] || i[0] > e[2] || e[1] > i[3] || i[1] > e[3]) && (o === R ? r = C : o === g ? r = n : (o === y || o === T) && (r = n.concat(t))), r;
  }
  function j(n, t, e) {
    let i = n, o = t;
    typeof n[0][0][0] == "number" && (i = [n]), typeof t[0][0][0] == "number" && (o = [t]);
    let r = it(i, o, e);
    if (r)
      return r === C ? null : r;
    const s = [1 / 0, 1 / 0, -1 / 0, -1 / 0], l = [1 / 0, 1 / 0, -1 / 0, -1 / 0], c = et(i, o, s, l, e);
    if (r = rt(i, o, s, l, e), r)
      return r === C ? null : r;
    const u = Q(
      c,
      i,
      o,
      s,
      l,
      e
    ), f = nt(u), p = [];
    for (let h = 0; h < f.length; h++) {
      let E = f[h];
      if (E.isExterior()) {
        let a = [E.points];
        for (let I = 0; I < E.holeIds.length; I++) {
          let d = E.holeIds[I];
          a.push(f[d].points);
        }
        p.push(a);
      }
    }
    return p;
  }
  function lt(n, t) {
    return j(n, t, y);
  }
  function ft(n, t) {
    return j(n, t, g);
  }
  function ht(n, t) {
    return j(n, t, T);
  }
  function ct(n, t) {
    return j(n, t, R);
  }
  const pt = { UNION: y, DIFFERENCE: g, INTERSECTION: R, XOR: T };

  exports.diff = ft;
  exports.intersection = ct;
  exports.operations = pt;
  exports.union = lt;
  exports.xor = ht;

  return exports;

})({});
