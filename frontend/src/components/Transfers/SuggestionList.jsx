/**
 * Transfer suggestions list component
 */
import React from 'react';
import SuggestionCard from './SuggestionCard';

const SuggestionList = ({ suggestions, loading, embedded = false, onReplace }) => {
  if (loading) {
    return (
      <div className="suggestions-loading">
        <div className="spinner"></div>
        <p>Analyzing your team with AI...</p>
        <p className="sub-text">This may take 10-20 seconds</p>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return <div className="no-suggestions">No suggestions available</div>;
  }

  return (
    <div className={`suggestions-container ${embedded ? 'embedded' : ''}`}>
      {!embedded && (
        <>
            <h2>Transfer Suggestions</h2>
            <p className="suggestions-intro">
                Our AI has analyzed your team's form, fixtures, and value to suggest these transfers:
            </p>
        </>
      )}

      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            suggestion={suggestion}
            onReplace={onReplace}
          />
        ))}
      </div>
    </div>
  );
};

export default SuggestionList;
