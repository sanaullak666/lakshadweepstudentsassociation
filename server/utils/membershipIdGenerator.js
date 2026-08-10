const db = require('../config/db');

const COMMITTEE_POSITIONS = [
  { key: 'president', title: 'President', order: 1, seq: '00001', defaultPassword: 'LSA@Pres2026' },
  { key: 'gen_secretary', title: 'General Secretary', order: 2, seq: '00002', defaultPassword: 'LSA@GenSec2026' },
  { key: 'treasurer', title: 'Treasurer', order: 3, seq: '00003', defaultPassword: 'LSA@Treas2026' },
  { key: 'publicity_chairman', title: 'Publicity Board Chairman', order: 4, seq: '00004', defaultPassword: 'LSA@PubChair2026' },
  { key: 'vice_president_1', title: 'Vice President 1', order: 5, seq: '00005', defaultPassword: 'LSA@VP12026' },
  { key: 'vice_president_2', title: 'Vice President 2', order: 6, seq: '00006', defaultPassword: 'LSA@VP22026' },
  { key: 'joint_secretary_1', title: 'Joint Secretary 1', order: 7, seq: '00007', defaultPassword: 'LSA@JS12026' },
  { key: 'joint_secretary_2', title: 'Joint Secretary 2', order: 8, seq: '00008', defaultPassword: 'LSA@JS22026' },
  { key: 'joint_secretary_3', title: 'Joint Secretary 3', order: 9, seq: '00009', defaultPassword: 'LSA@JS32026' }
];

function getPositionByKey(key) {
  if (!key) return null;
  const clean = String(key).trim().toLowerCase();
  return COMMITTEE_POSITIONS.find(p => p.key === clean || p.title.toLowerCase() === clean) || null;
}

function getReservedIdForOrder(order, year = new Date().getFullYear()) {
  const padded = String(order).padStart(5, '0');
  return `LSA-${year}-${padded}`;
}

/**
 * Generates a unique, sequential Membership ID in the format LSA-YYYY-XXXXX
 * General members start from LSA-YYYY-00010 onwards to reserve 00001-00009 for Central Committee.
 */
async function generateMembershipId() {
  const year = new Date().getFullYear();
  const prefix = `LSA-${year}-`;

  const result = await db.query(
    "SELECT membership_id FROM members WHERE membership_id LIKE ?",
    [`${prefix}%`]
  );

  let maxSequence = 9; // First 9 IDs (00001 - 00009) reserved for Central Committee

  if (result.rows && result.rows.length > 0) {
    for (const row of result.rows) {
      if (row.membership_id) {
        const parts = row.membership_id.split('-');
        if (parts.length === 3) {
          const parsedSeq = parseInt(parts[2], 10);
          if (!isNaN(parsedSeq) && parsedSeq > maxSequence) {
            maxSequence = parsedSeq;
          }
        }
      }
    }
  }

  const nextSequence = maxSequence + 1;
  const paddedSequence = String(nextSequence).padStart(5, '0');
  return `${prefix}${paddedSequence}`;
}

module.exports = {
  COMMITTEE_POSITIONS,
  getPositionByKey,
  getReservedIdForOrder,
  generateMembershipId
};

