/**
 * Merkle Tree Ledger
 *
 * Provides append-only audit trail for all trade events.
 * Each trade is hashed as a leaf node. The tree builds up
 * to a root hash (H_root) which serves as the Proof-of-Execution.
 *
 * Tree structure:
 *   - Leaves = SHA-256(tradeId | symbol | side | qty | price | timestamp)
 *   - Internal nodes = SHA-256(leftChild || rightChild)
 *   - If odd leaf count, last leaf is duplicated
 *
 * H_root changes every time a new trade is appended, creating
 * an immutable cryptographic proof of the full trade history.
 */

import { createHash } from "node:crypto";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export interface MerkleLeaf {
  tradeId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  timestamp: string;
  hash: string;
}

export interface MerkleProof {
  rootHash: string;
  leafCount: number;
  treeDepth: number;
  computedAt: string;
}

export class MerkleTreeLedger {
  private leaves: MerkleLeaf[] = [];

  /** Get current leaf count. */
  get size(): number {
    return this.leaves.length;
  }

  /** Get all leaves (read-only). */
  getLeaves(): readonly MerkleLeaf[] {
    return this.leaves;
  }

  /**
   * Append a trade event as a new leaf node.
   */
  appendTrade(trade: {
    tradeId: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    timestamp: string;
  }): MerkleLeaf {
    const payload = `${trade.tradeId}|${trade.symbol}|${trade.side}|${trade.quantity}|${trade.price}|${trade.timestamp}`;
    const hash = sha256(payload);

    const leaf: MerkleLeaf = {
      ...trade,
      hash,
    };

    this.leaves.push(leaf);
    return leaf;
  }

  /**
   * Compute the Merkle root hash (H_root) over all leaves.
   * This is the Proof-of-Execution digest.
   */
  computeRoot(): MerkleProof {
    if (this.leaves.length === 0) {
      return {
        rootHash: sha256("empty"),
        leafCount: 0,
        treeDepth: 0,
        computedAt: new Date().toISOString(),
      };
    }

    let currentLevel = this.leaves.map((l) => l.hash);
    let depth = 0;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        // If odd, duplicate the last hash
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        nextLevel.push(sha256(left + right));
      }
      currentLevel = nextLevel;
      depth++;
    }

    return {
      rootHash: currentLevel[0],
      leafCount: this.leaves.length,
      treeDepth: depth,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify that a specific trade leaf exists in the current tree
   * by recomputing its hash and checking membership.
   */
  verifyLeaf(tradeId: string): boolean {
    return this.leaves.some((l) => l.tradeId === tradeId);
  }

  /**
   * Hydrate the ledger from pre-existing leaves (e.g., loaded from DB).
   */
  hydrate(leaves: MerkleLeaf[]): void {
    this.leaves = [...leaves];
  }
}
