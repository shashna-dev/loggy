import React, { useMemo, useState } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import type {
  Client,
  DocumentCategory,
  DocumentLinkedEntityType,
  DocumentRecord,
  Invoice,
  Placement,
  Timesheet,
  Worker
} from '../types';

interface DocumentVaultProps {
  workers: Worker[];
  clients: Client[];
  placements: Placement[];
  timesheets: Timesheet[];
  invoices: Invoice[];
  documents: DocumentRecord[];
  uploadedBy: string;
  onAddDocument: (document: DocumentRecord) => void;
  onDeleteDocument: (documentId: string) => void;
}

const categoryLabels: Record<DocumentCategory, string> = {
  timesheet: 'Timesheet',
  invoice: 'Invoice',
  contract: 'Contract',
  worker_id: 'Worker ID',
  payroll: 'Payroll',
  client_record: 'Client Record',
  other: 'Other'
};

const linkedEntityLabels: Record<DocumentLinkedEntityType, string> = {
  client: 'Client',
  worker: 'Worker',
  placement: 'Placement',
  timesheet: 'Timesheet',
  invoice: 'Invoice',
  none: 'Unlinked'
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({
  workers,
  clients,
  placements,
  timesheets,
  invoices,
  documents,
  uploadedBy,
  onAddDocument,
  onDeleteDocument
}) => {
  const [category, setCategory] = useState<DocumentCategory>('timesheet');
  const [linkedEntityType, setLinkedEntityType] = useState<DocumentLinkedEntityType>('none');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<'all' | DocumentCategory>('all');
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [uploading, setUploading] = useState(false);

  const linkedOptions = useMemo(() => {
    if (linkedEntityType === 'client') {
      return clients.map(client => ({ id: client.id, label: client.companyName }));
    }
    if (linkedEntityType === 'worker') {
      return workers.map(worker => ({ id: worker.id, label: worker.name }));
    }
    if (linkedEntityType === 'placement') {
      return placements.map(placement => {
        const worker = workers.find(item => item.id === placement.workerId);
        const client = clients.find(item => item.id === placement.clientId);
        return { id: placement.id, label: `${worker?.name || 'Worker'} @ ${client?.companyName || 'Client'}` };
      });
    }
    if (linkedEntityType === 'timesheet') {
      return timesheets.map(timesheet => {
        const placement = placements.find(item => item.id === timesheet.placementId);
        const worker = placement ? workers.find(item => item.id === placement.workerId) : undefined;
        return { id: timesheet.id, label: `${worker?.name || 'Worker'} | ${timesheet.cycleStartDate} to ${timesheet.cycleEndDate}` };
      });
    }
    if (linkedEntityType === 'invoice') {
      return invoices.map(invoice => {
        const client = clients.find(item => item.id === invoice.clientId);
        return { id: invoice.id, label: `${invoice.id} | ${client?.companyName || 'Client'} | CAD ${invoice.total.toFixed(2)}` };
      });
    }
    return [];
  }, [linkedEntityType, workers, clients, placements, timesheets, invoices]);

  const filteredDocuments = documents.filter(document => filter === 'all' || document.category === filter);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onAddDocument({
        id: `doc-${Date.now()}`,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl,
        category,
        linkedEntityType,
        linkedEntityId: linkedEntityType === 'none' ? undefined : linkedEntityId || undefined,
        notes: notes.trim() || undefined,
        uploadedAt: new Date().toISOString(),
        uploadedBy
      });
      setNotes('');
      event.target.value = '';
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Document Vault</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
              Upload and attach source files to clients, workers, placements, timesheets, invoices, or payroll records.
            </p>
          </div>
          <span className="badge badge-submitted">{documents.length} stored file{documents.length === 1 ? '' : 's'}</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Document Category</label>
            <select className="form-control" value={category} onChange={event => setCategory(event.target.value as DocumentCategory)}>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Attach To</label>
            <select
              className="form-control"
              value={linkedEntityType}
              onChange={event => {
                setLinkedEntityType(event.target.value as DocumentLinkedEntityType);
                setLinkedEntityId('');
              }}
            >
              {Object.entries(linkedEntityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {linkedEntityType !== 'none' && (
          <div className="form-group">
            <label>{linkedEntityLabels[linkedEntityType]} Record</label>
            <select className="form-control" value={linkedEntityId} onChange={event => setLinkedEntityId(event.target.value)}>
              <option value="">Select record</option>
              {linkedOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Notes</label>
          <textarea
            className="form-control"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            rows={2}
            placeholder="Optional context, expiry date, source, or processing notes"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Upload File</label>
          <input
            type="file"
            className="form-control"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,text/plain,application/pdf"
            onChange={handleUpload}
            disabled={uploading || (linkedEntityType !== 'none' && !linkedEntityId)}
          />
          {linkedEntityType !== 'none' && !linkedEntityId && (
            <p style={{ color: 'var(--color-warning)', fontSize: '0.78rem', marginTop: '8px' }}>Select a record before uploading.</p>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Stored Documents</h3>
          <div className="form-group" style={{ minWidth: '220px', marginBottom: 0 }}>
            <label>Filter</label>
            <select className="form-control" value={filter} onChange={event => setFilter(event.target.value as 'all' | DocumentCategory)}>
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <div style={{ padding: '36px', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            No documents match this view.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Linked Record</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map(document => (
                  <tr key={document.id}>
                    <td>
                      <strong>{document.fileName}</strong>
                      <div style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>{document.fileType || 'Unknown type'} | {formatSize(document.fileSize)}</div>
                    </td>
                    <td><span className="badge badge-draft">{categoryLabels[document.category]}</span></td>
                    <td>
                      {linkedEntityLabels[document.linkedEntityType]}
                      {document.linkedEntityId && <div style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>{document.linkedEntityId}</div>}
                    </td>
                    <td>
                      {new Date(document.uploadedAt).toLocaleDateString()}
                      <div style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>{document.uploadedBy}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => setSelectedDocument(document)} style={{ padding: '6px 8px' }}>
                          <FileText size={14} /> View
                        </button>
                        <a className="btn btn-secondary" href={document.dataUrl} download={document.fileName} style={{ padding: '6px 8px', textDecoration: 'none' }}>
                          <Download size={14} /> Download
                        </a>
                        <button className="btn btn-danger" onClick={() => {
                          if (confirm(`Delete ${document.fileName}?`)) onDeleteDocument(document.id);
                        }} style={{ padding: '6px 8px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDocument && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <div>
                <h3>{selectedDocument.fileName}</h3>
                <p style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>{categoryLabels[selectedDocument.category]} | {formatSize(selectedDocument.fileSize)}</p>
              </div>
              <button className="close-btn" onClick={() => setSelectedDocument(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {selectedDocument.notes && (
                <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', marginBottom: '14px' }}>{selectedDocument.notes}</p>
              )}
              {selectedDocument.fileType.startsWith('image/') ? (
                <img src={selectedDocument.dataUrl} alt={selectedDocument.fileName} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              ) : selectedDocument.fileType === 'application/pdf' ? (
                <iframe src={selectedDocument.dataUrl} title={selectedDocument.fileName} style={{ width: '100%', height: '65vh', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
              ) : (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-sub)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  Preview is not available for this file type. Use download to open it locally.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <a className="btn btn-primary" href={selectedDocument.dataUrl} download={selectedDocument.fileName} style={{ textDecoration: 'none' }}>
                <Download size={16} /> Download File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
