import { useState, useEffect } from 'react';
import { X, FolderPlus, Edit2 } from 'lucide-react';
import './NewCaseModal.css';

const NewCaseModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialName = '',
  mode = 'create' // 'create' | 'rename'
}) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSubmit(name);
    setName('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {mode === 'create' ? <FolderPlus size={20} className="text-primary" /> : <Edit2 size={20} className="text-info" />}
            {mode === 'create' ? 'Create New Case' : 'Rename Case'}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="caseName">Case Name</label>
              <input
                id="caseName"
                type="text"
                className="input-field"
                placeholder={mode === 'create' ? "e.g., Q3 Marketing Prompts" : "Enter new name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            {mode === 'create' && (
              <p className="text-sm text-secondary">
                This will create a new workspace for versioning your prompts.
              </p>
            )}
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className={`btn ${mode === 'create' ? 'btn-primary' : 'btn-info'}`}
              disabled={!name.trim()}
            >
              {mode === 'create' ? 'Create Case' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCaseModal;
