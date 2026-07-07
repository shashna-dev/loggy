import React, { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { parseTimesheetText, type ImportedTimesheetRow } from '../timesheetImport';

interface TimesheetImportModalProps {
  title?: string;
  targetLabel?: string;
  onClose: () => void;
  onApply: (rows: ImportedTimesheetRow[]) => void;
}

export const TimesheetImportModal: React.FC<TimesheetImportModalProps> = ({
  title = 'Import Timesheet From File',
  targetLabel,
  onClose,
  onApply
}) => {
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [rows, setRows] = useState<ImportedTimesheetRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file) return;

    setFileName(file.name);
    setError('');
    setRows([]);
    setProcessing(true);

    try {
      let text = '';
      if (file.type.startsWith('image/')) {
        const { recognize } = await import('tesseract.js');
        const result = await recognize(file, 'eng');
        text = result.data.text;
      } else {
        text = await file.text();
      }

      const parsedRows = parseTimesheetText(text);
      setRawText(text);
      setRows(parsedRows);
      if (parsedRows.length === 0) {
        setError('No complete shifts were found. Try a clearer image or paste text with date, start time, and end time.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not read this file. Use a clear image, .txt, .csv, or pasted timesheet text.');
    } finally {
      setProcessing(false);
    }
  };

  const handleParseText = () => {
    const parsedRows = parseTimesheetText(rawText);
    setRows(parsedRows);
    setError(parsedRows.length === 0 ? 'No complete shifts were found in the pasted text.' : '');
  };

  const handleRowChange = (
    rowId: string,
    field: keyof Pick<ImportedTimesheetRow, 'workerName' | 'date' | 'startTime' | 'endTime' | 'breakMinutes'>,
    value: string
  ) => {
    setRows(currentRows => currentRows.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        [field]: field === 'breakMinutes' ? Math.max(0, Number(value) || 0) : value,
        confidence: row.confidence === 'high' ? 'medium' : row.confidence
      };
    }));
  };

  const handleRemoveRow = (rowId: string) => {
    setRows(currentRows => currentRows.filter(row => row.id !== rowId));
  };

  const invalidRowCount = rows.filter(row => !row.date || !row.startTime || !row.endTime).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '860px' }}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {targetLabel && (
              <p style={{ color: 'var(--text-sub)', fontSize: '0.8rem', marginTop: '2px' }}>{targetLabel}</p>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Upload Image, Text, CSV, or TSV</label>
            <input
              type="file"
              className="form-control"
              accept="image/*,.txt,.csv,.tsv,text/plain,text/csv"
              onChange={event => handleFile(event.target.files?.[0] || null)}
            />
            {fileName && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: '8px' }}>
                Selected: {fileName}
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Extracted / Pasted Timesheet Text</label>
            <textarea
              className="form-control"
              value={rawText}
              onChange={event => setRawText(event.target.value)}
              placeholder="Paste timesheet text here, or upload a clear photo. Example: Tasal Ashna 2026-07-07 08:00 17:00 break 30"
              rows={6}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleParseText} disabled={!rawText.trim() || processing}>
              <FileText size={16} /> Extract Fields
            </button>
            {processing && (
              <span style={{ color: 'var(--color-info)', fontSize: '0.85rem', fontWeight: 600 }}>
                Reading file and extracting text...
              </span>
            )}
          </div>

          {error && (
            <div style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', color: 'var(--color-warning)', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Detected Shifts</h4>
          {rows.length > 0 && (
            <p style={{ color: 'var(--text-sub)', fontSize: '0.8rem', marginBottom: '10px' }}>
              Review and correct extracted values before saving. Required fields are date, start time, and end time.
            </p>
          )}
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
              No shifts detected yet.
            </div>
          ) : (
            <div className="table-container" style={{ marginTop: 0 }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Break</th>
                    <th>Confidence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <input
                          className="form-control"
                          value={row.workerName || ''}
                          onChange={event => handleRowChange(row.id, 'workerName', event.target.value)}
                          placeholder="Optional"
                          style={{ minWidth: '150px', padding: '7px 9px', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="date"
                          value={row.date}
                          onChange={event => handleRowChange(row.id, 'date', event.target.value)}
                          style={{ minWidth: '136px', padding: '7px 9px', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="time"
                          value={row.startTime}
                          onChange={event => handleRowChange(row.id, 'startTime', event.target.value)}
                          style={{ minWidth: '104px', padding: '7px 9px', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="time"
                          value={row.endTime}
                          onChange={event => handleRowChange(row.id, 'endTime', event.target.value)}
                          style={{ minWidth: '104px', padding: '7px 9px', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="number"
                          min={0}
                          value={row.breakMinutes}
                          onChange={event => handleRowChange(row.id, 'breakMinutes', event.target.value)}
                          style={{ minWidth: '86px', padding: '7px 9px', fontSize: '0.78rem' }}
                        />
                      </td>
                      <td>
                        <span className={`badge ${row.confidence === 'high' ? 'badge-approved' : row.confidence === 'medium' ? 'badge-pending' : 'badge-draft'}`}>
                          {row.confidence}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRemoveRow(row.id)}
                          style={{ padding: '6px 8px' }}
                          title="Remove detected row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {invalidRowCount > 0 && (
            <span style={{ color: 'var(--color-warning)', fontSize: '0.8rem', marginRight: 'auto' }}>
              {invalidRowCount} row{invalidRowCount === 1 ? '' : 's'} missing required fields
            </span>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={rows.length === 0 || processing || invalidRowCount > 0} onClick={() => onApply(rows)}>
            Add {rows.length || ''} Shift{rows.length === 1 ? '' : 's'} to Timesheet
          </button>
        </div>
      </div>
    </div>
  );
};
