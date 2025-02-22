import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
  IconButton,
  DialogContentText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Edit as EditIcon,
  FileUpload as FileUploadIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Circle as CircleIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { 
  getProject, 
  getProjectDocuments, 
  updateProject, 
  uploadDocument, 
  exportProjectData,
  createDocument,
  updateDocument,
  bulkDeleteDocuments,
  deleteProject
} from '../../utils/api';
import HomeButton from '../common/HomeButton';
import ProjectCreate from './ProjectCreate';

const COLOR_PALETTE = [
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#f44336',
  '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a',
  '#cddc39', '#795548', '#9e9e9e', '#607d8b',
];

const ProjectView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newText, setNewText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showProjectCreate, setShowProjectCreate] = useState(false);
  const [editedProject, setEditedProject] = useState({
    name: '',
    description: '',
    entity_classes: [],
  });
  const [newEntity, setNewEntity] = useState({ name: '', color: COLOR_PALETTE[0], description: '' });
  const [editingEntityName, setEditingEntityName] = useState({ entity: null, name: '' });
  const [documentViewDialogOpen, setDocumentViewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [docsPerPage, setDocsPerPage] = useState(5);
  const [totalPages, setTotalPages] = useState(1);


  const handleNext = () => {
    if (page < totalPages) setPage((prevPage) => prevPage + 1);
  };

  const handlePrev = () => {
    if (page > 1) {
      setPage((prevPage) => prevPage - 1);
    };
  };


  const handlePageLimitChange = (event) => {
    const newLimit = parseInt(event.target.value, 10);
    setDocsPerPage(newLimit);
    setPage(1); // Reset to first page when changing docsPerPage
  };

  useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectData, documentsData] = await Promise.all([
          getProject(projectId),
          getProjectDocuments(projectId, { page: page, docsPerPage: docsPerPage }) // Fetch all documents
        ]);

        if (isSubscribed) {
          const { total_count, documents } = documentsData;
          setTotalPages(Math.ceil(total_count / docsPerPage));
          setProject(projectData);
          setEditedProject(projectData);
          setDocuments(documents);
        }
        console.log("Documents:", documents, typeof documents);
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isSubscribed) {
          toast.error('Failed to load project data');
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    if (projectId) {
      fetchData();
    }

    return () => {
      isSubscribed = false;
    };
  }, [projectId,page,docsPerPage]);

  const refreshData = async () => {
    try {
      setLoading(true);
      const [projectData, documentsData] = await Promise.all([
        getProject(projectId),
        getProjectDocuments(projectId, { page: page, docsPerPage: docsPerPage }) // Fetch all documents
      ]);
      const { total_count, documents } = documentsData;

      setProject(projectData);
      setEditedProject(projectData);
      setDocuments(documents);
      setTotalPages(Math.ceil(total_count / docsPerPage));
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh project data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProject = () => {
    setEditedProject({
      name: project.name,
      description: project.description,
      entity_classes: project.entity_classes
    });
    setShowProjectCreate(true);
  };

  const handleSaveProject = async (updatedProject) => {
    try {
      setLoading(true);
      const response = await updateProject(project.id, updatedProject);
      
      // Get the number of updated documents
      const updatedCount = response?.updated_documents_count;
      
      // Show success message with the count of updated documents
      if (updatedCount > 0) {
        toast.success(`Successfully updated entity name in ${updatedCount} document${updatedCount === 1 ? '' : 's'}`);
      } else {
        toast.success('Project updated successfully');
      }
      
      // Refresh data and close dialog
      await refreshData();
      setShowProjectCreate(false);
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Error saving project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntity = () => {
    if (!newEntity.name) {
      toast.error('Please enter an entity name');
      return;
    }

    if (editedProject.entity_classes.some(e => e.name === newEntity.name)) {
      toast.error('Entity with this name already exists');
      return;
    }

    setEditedProject(prev => ({
      ...prev,
      entity_classes: [...prev.entity_classes, { ...newEntity }]
    }));
    setNewEntity({ name: '', color: COLOR_PALETTE[0], description: '' });
  };

  const handleRemoveEntity = (entityName) => {
    setEditedProject(prev => ({
      ...prev,
      entity_classes: prev.entity_classes.filter(e => e.name !== entityName)
    }));
  };

  const handleCreateDocument = async () => {
    if (!newText.trim()) {
      toast.error('Please enter some text');
      return;
    }

    try {
      await createDocument({
        text: newText.trim(),
        project_id: projectId
      });
      setNewText('');
      setOpenDialog(false);
      await refreshData();
      toast.success('Document created successfully');
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create document');
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploading(true);
    try {
      const response = await uploadDocument(projectId, files);
      await refreshData();
      
      // Show appropriate success/warning message based on upload results
      if (response.failed_count > 0) {
        if (response.uploaded_count > 0) {
          toast.warning(
            `Uploaded ${response.uploaded_count} document(s) successfully, but ${response.failed_count} file(s) failed. Check console for details.`
          );
          console.log('Failed uploads:', response.failed_documents);
        } else {
          toast.error('Failed to upload documents. Check console for details.');
          console.log('Failed uploads:', response.failed_documents);
        }
      } else {
        toast.success(`Successfully uploaded ${response.uploaded_count} document(s)`);
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportProjectData(projectId);
      const blob = new Blob([data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_${projectId}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting project:', error);
      toast.error('Failed to export project data');
    }
  };

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleEntityNameInputChange = (entity, newValue) => {
    setEditingEntityName({ entity, name: newValue });
  };

  const handleEntityNameInputBlur = async (entity) => {
    if (editingEntityName.entity === entity && editingEntityName.name) {
      await handleEditEntityName(entity, editingEntityName.name);
    }
    setEditingEntityName({ entity: null, name: '' });
  };

  const handleEntityNameKeyPress = async (event, entity) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.target.blur();
    }
  };

  const handleEditEntityName = async (entity, newName) => {
    if (!newName.trim() || newName === entity.name) return;

    // Check if the new name already exists
    if (editedProject.entity_classes.some(e => e.name === newName && e.name !== entity.name)) {
      toast.error('An entity with this name already exists');
      return;
    }

    try {
      setLoading(true);
      
      // First update the project's entity classes
      const updatedProject = {
        ...editedProject,
        entity_classes: editedProject.entity_classes.map(e =>
          e.name === entity.name ? { ...e, name: newName } : e
        )
      };

      // Update the project and get the response with updated document count
      const response = await updateProject(projectId, updatedProject);
      console.log('Project update response:', response);
      
      const updatedCount = response?.updated_documents_count || 0;
      console.log('Updated documents count:', updatedCount);

      // Update local state
      setEditedProject(updatedProject);
      setProject(updatedProject);
      
      // Refresh documents to show updated annotations
      const updatedDocs = await getProjectDocuments(projectId, { skip: 0, limit: -1 });
      setDocuments(updatedDocs);
      
      toast.success(`Successfully updated entity name in ${updatedCount} document${updatedCount === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Error updating entity name:', error);
      toast.error('Failed to update entity name');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentView = (document) => {
    setSelectedDocument(document);
    setDocumentViewDialogOpen(true);
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedDocuments(documents.map(doc => doc.id));
    } else {
      setSelectedDocuments([]);
    }
  };

  const handleSelectDocument = (documentId) => {
    setSelectedDocuments(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      await bulkDeleteDocuments(selectedDocuments);
      setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)));
      setSelectedDocuments([]);
      toast.success('Documents deleted successfully');
    } catch (error) {
      console.error('Error deleting documents:', error);
      toast.error('Failed to delete documents');
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await deleteProject(projectId);
      toast.success('Project deleted successfully');
      navigate('/projects'); // Navigate back to projects list
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
    setShowDeleteProjectDialog(false);
  };

  const handleEditEntityDescription = (entity, description) => {
    setEditedProject(prev => ({
      ...prev,
      entity_classes: prev.entity_classes.map(e => 
        e.name === entity.name ? { ...e, description } : e
      )
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (showProjectCreate) {
    return (
      <ProjectCreate
        onClose={() => setShowProjectCreate(false)}
        onSubmit={handleSaveProject}
        initialData={editedProject}
        isEdit={true}
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <HomeButton />
      {/* Project Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4">{project?.name}</Typography>
          <Box>
            <Button
              startIcon={<EditIcon />}
              onClick={handleEditProject}
              sx={{ mr: 1 }}
            >
              Edit Project
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              sx={{ mr: 1 }}
            >
              Export
            </Button>
            <Button
              startIcon={<DeleteIcon />}
              color="error"
              onClick={() => setShowDeleteProjectDialog(true)}
            >
              Delete Project
            </Button>
          </Box>
        </Box>
        <Typography color="textSecondary" paragraph>
          {project?.description}
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          {project?.entity_classes.map((entity) => (
            <Chip
              key={entity.name}
              label={entity.name}
              style={{ backgroundColor: entity.color }}
            />
          ))}
        </Box>
      </Paper>

      {/* Documents Section */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Documents</Typography>
          <Box>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              sx={{ mr: 2 }}
            >
              <ToggleButton value="grid">
                <GridViewIcon />
              </ToggleButton>
              <ToggleButton value="list">
                <ListViewIcon />
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              startIcon={<FileUploadIcon />}
              component="label"
              disabled={uploading}
            >
              Upload Files
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="file-upload-input"
                accept=".txt,.md,.json,.csv"
              />
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDialog(true)}
              sx={{ mr: 1 }}
            >
              Add Document
            </Button>
            {selectedDocuments.length > 0 && (
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete Selected ({selectedDocuments.length})
              </Button>
            )}
          </Box>
        </Box>

        {viewMode === 'grid' ? (
          <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <Checkbox
                indeterminate={selectedDocuments.length > 0 && selectedDocuments.length < documents.length}
                checked={documents.length > 0 && selectedDocuments.length === documents.length}
                onChange={handleSelectAll}
              />
              <Typography variant="body2" sx={{ ml: 1 }}>
                Select All
              </Typography>
              <Box display="flex" justifyContent="flex-end" flexGrow={1} gap={1}>
                <label htmlFor="documentLimit" style={{ fontSize: '18px' }}>Documents per page:</label>
                <select name="documentLimit" id="documentLimit" value={docsPerPage} onChange={handlePageLimitChange} style={{padding: '8px 12px', fontSize: '16px',borderRadius: '8px',border: '1px solid #1976d2', backgroundColor: 'white',color: '#1976d2', cursor: 'pointer',outline: 'none', transition: 'all 0.3s ease', appearance: 'none'}}>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                </select>
                <Button variant="outlined" onClick={handlePrev}>Prev</Button>
                <Button variant="outlined" onClick={handleNext}>Next</Button>
              </Box>
            </Box>
            <Grid container spacing={3}>
              {documents.map((doc) => (
                <Grid item xs={12} sm={6} md={4} key={doc.id}>
                  <Paper 
                    sx={{ 
                      p: 2,
                      height: '100%',
                      position: 'relative',
                      border: selectedDocuments.includes(doc.id) ? 2 : 1,
                      borderColor: selectedDocuments.includes(doc.id) ? 'primary.main' : 'divider',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <Box sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}>
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleSelectDocument(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Box>
                    <Box 
                      sx={{ 
                        mt: 3, 
                        flex: 1, 
                        display: 'flex', 
                        flexDirection: 'column' 
                      }}
                      onClick={() => handleSelectDocument(doc.id)}
                    >
                      <Typography 
                        variant="body2" 
                        color="textSecondary" 
                        sx={{ 
                          mb: 2,
                          flex: 1,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical'
                        }}
                      >
                        {doc.text}
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        mt: 'auto'
                      }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: doc.status === 'completed' ? 'success.main' : 'text.secondary',
                            textTransform: 'capitalize'
                          }}
                        >
                          {doc.status?.replace('_', ' ') || 'Not Started'}
                        </Typography>
                        <Box>
                          <Tooltip title="View">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDocumentView(doc);
                              }}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Annotate">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/annotate/${doc.id}`);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedDocuments.length > 0 && selectedDocuments.length < documents.length}
                      checked={documents.length > 0 && selectedDocuments.length === documents.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Document Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow
                    key={doc.id}
                    hover
                    selected={selectedDocuments.includes(doc.id)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleSelectDocument(doc.id)}
                      />
                    </TableCell>
                    <TableCell>{doc.text?.substring(0, 100) || 'No content'}</TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          color: doc.status === 'completed' ? 'success.main' : 'text.secondary',
                          textTransform: 'capitalize'
                        }}
                      >
                        {doc.status?.replace('_', ' ') || 'Not Started'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View">
                        <IconButton
                          onClick={() => handleDocumentView(doc)}
                          size="small"
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Annotate">
                        <IconButton
                          onClick={() => navigate(`/annotate/${doc.id}`)}
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add Document Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Document Text"
            fullWidth
            multiline
            rows={4}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateDocument} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      >
        <DialogTitle>Delete Documents</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedDocuments.length} selected document{selectedDocuments.length === 1 ? '' : 's'}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        open={showDeleteProjectDialog}
        onClose={() => setShowDeleteProjectDialog(false)}
      >
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this project? This action will permanently delete the project and all its associated documents. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteProjectDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained">
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>

      <DocumentViewDialog 
        open={documentViewDialogOpen} 
        onClose={() => setDocumentViewDialogOpen(false)} 
        document={selectedDocument} 
        entityClasses={project?.entity_classes}
        navigate={navigate}
      />
    </Container>
  );
};

const DocumentViewDialog = ({ open, onClose, document, entityClasses, navigate }) => {
  const getHighlightColor = (entityName) => {
    const entity = entityClasses.find(e => e.name === entityName);
    return entity ? entity.color : '#ffffff';
  };

  const renderHighlightedText = () => {
    if (!document?.text || !document?.annotations) return document?.text;

    // Sort annotations by start_index to handle overlapping
    const sortedAnnotations = [...document.annotations].sort((a, b) => a.start_index - b.start_index);
    
    let lastIndex = 0;
    const textParts = [];

    sortedAnnotations.forEach((annotation, index) => {
      // Add text before the annotation
      if (annotation.start_index > lastIndex) {
        textParts.push(
          <span key={`text-${index}`}>
            {document.text.slice(lastIndex, annotation.start_index)}
          </span>
        );
      }

      // Add the highlighted annotation
      textParts.push(
        <span
          key={`highlight-${index}`}
          style={{
            backgroundColor: getHighlightColor(annotation.entity),
            padding: '0 1px',
            margin: '0',
            borderRadius: '2px',
            display: 'inline',
            lineHeight: '1.5',
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone'
          }}
        >
          {document.text.slice(annotation.start_index, annotation.end_index)}
        </span>
      );

      lastIndex = annotation.end_index;
    });

    // Add any remaining text
    if (lastIndex < document.text.length) {
      textParts.push(
        <span key="text-end">
          {document.text.slice(lastIndex)}
        </span>
      );
    }

    return textParts;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      onClick={(e) => e.stopPropagation()}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Document View</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <Typography variant="subtitle1" gutterBottom>Annotations:</Typography>
          {document?.annotations?.map((annotation, index) => (
            <Chip
              key={index}
              label={`${annotation.text} (${annotation.entity})`}
              style={{ 
                backgroundColor: getHighlightColor(annotation.entity),
                margin: '0 4px 4px 0'
              }}
            />
          ))}
        </Box>
        <Typography variant="subtitle1" gutterBottom>Document Text:</Typography>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            maxHeight: '400px', 
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            wordWrap: 'break-word',
            backgroundColor: '#f5f5f5',
            lineHeight: 1.6,
            fontSize: '1rem',
            '& span[style*="background-color"]': {
              padding: '0 1px',
              margin: '0',
              borderRadius: '2px',
              display: 'inline',
              lineHeight: '1.5',
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone'
            }
          }}
        >
          {renderHighlightedText()}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<EditIcon />}
          onClick={() => {
            onClose();
            navigate(`/annotate/${document?.id}`);
          }}
        >
          Annotate
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectView;
