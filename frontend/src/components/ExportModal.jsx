import React from 'react';
import { EXPORT_SECTIONS } from '../constants/reportConstants';

const ExportModal = ({isOpen,onClose,onExport,selectedSections,setSelectedSections}) => {
    if(!isOpen) return null;
    const toggle = id => setSelectedSections(p => 
        p.includes(id) ? p.filter(s => s !== id) : [...p, id]
    );
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <h3 className="modal-title">📄 Export PDF — Select Sections</h3>
                <p className="modal-subtitle">Choose which sections to include.</p>
                <div className="modal-actions-row">
                    <button className="modal-btn-link" onClick={() => setSelectedSections(EXPORT_SECTIONS.map(s => s.id))}>
                        Select All
                    </button>
                    <button className="modal-btn-link" onClick={() => setSelectedSections([])}>
                        Deselect All
                    </button>
                </div>
                <div className="modal-checklist">
                    {EXPORT_SECTIONS.map(s => (
                        <label key={s.id} className="modal-check-item">
                            <input 
                                type="checkbox" 
                                checked={selectedSections.includes(s.id)} 
                                onChange={() => toggle(s.id)}
                            />
                            <span>{s.label}</span>
                        </label>
                    ))}
                </div>
                <div className="modal-footer">
                    <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="modal-btn-primary" onClick={onExport}>Export PDF</button>
                </div>
            </div>
        </div>
    );
};

export default ExportModal;