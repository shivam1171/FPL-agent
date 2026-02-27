/**
 * Transfer approval confirmation modal
 */
import React, { useState } from 'react';

const ApprovalModal = ({ suggestion, onConfirm, onCancel }) => {
  const [executing, setExecuting] = useState(false);

  const handleConfirm = async () => {
    setExecuting(true);
    await onConfirm();
    setExecuting(false);
  };

  const playerOut = suggestion.player_out;
  const playerIn = suggestion.player_in;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Confirm Transfer</h2>

        <div className="modal-transfer">
          <div className="modal-player">
            <span className="out-label">OUT</span>
            <strong>{playerOut.web_name}</strong>
            <span>{playerOut.position}</span>
          </div>

          <div className="modal-arrow">→</div>

          <div className="modal-player">
            <span className="in-label">IN</span>
            <strong>{playerIn.web_name}</strong>
            <span>{playerIn.position}</span>
          </div>
        </div>

        <div className="modal-details">
          <div className="detail-row">
            <span>Cost change:</span>
            <strong>£{suggestion.cost_change.toFixed(1)}m</strong>
          </div>
          <div className="detail-row">
            <span>Bank after transfer:</span>
            <strong>£{suggestion.bank_after.toFixed(1)}m</strong>
          </div>
          <div className="detail-row">
            <span>Expected points gain:</span>
            <strong>+{suggestion.expected_points_gain.toFixed(1)} pts</strong>
          </div>
        </div>

        <div className="modal-warning">
          ⚠️ This will make an actual transfer in your FPL team. Are you sure?
        </div>

        <div className="modal-actions">
          <button onClick={onCancel} className="cancel-btn" disabled={executing}>
            Cancel
          </button>
          <button onClick={handleConfirm} className="confirm-btn" disabled={executing}>
            {executing ? 'Executing...' : 'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
