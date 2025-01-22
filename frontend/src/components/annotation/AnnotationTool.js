import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Popover,
  FormControl,
  Select,
  MenuItem,
  Stack,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import {
  getDocument,
  updateDocument,
  getProject,
  getProjectDocuments,
} from '../../utils/api';

const AnnotationTool = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [docData, setDocData] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedEntityIndex, setFocusedEntityIndex] = useState(null);
  const [autoSave, setAutoSave] = useState(false);
  const [unsavedDocuments, setUnsavedDocuments] = useState(new Set());
  const [documentChanges, setDocumentChanges] = useState(new Map());
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const textContentRef = React.useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // First get the document to get its project_id
      const doc = await getDocument(documentId);
      console.log('Raw document data:', doc);
      
      // Then fetch project data and documents in parallel
      const [projectData, projectDocs] = await Promise.all([
        getProject(doc.project_id),
        getProjectDocuments(doc.project_id)
      ]);

      if (!projectData) {
        toast.error('Project data not found');
        navigate('/projects');
        return;
      }

      // Update entity colors based on project entity classes
      const updatedEntities = (doc.annotations || []).map(annotation => ({
        start: annotation.start_index,
        end: annotation.end_index,
        label: annotation.entity,
        text: annotation.text,
        color: projectData.entity_classes.find(ec => ec.name === annotation.entity)?.color || '#ffeb3b'
      }));

      console.log('Loaded entities:', updatedEntities);

      setProjectData(projectData);
      setDocData(doc);
      setEntities(updatedEntities);
      setProjectDocuments(projectDocs);
      
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error('Error loading document');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [documentId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (docData) {
      // Initialize document changes with existing annotations
      setDocumentChanges(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(documentId)) {
          newMap.set(documentId, {
            entities: docData.entities || [],
            annotations: docData.annotations || []
          });
        }
        return newMap;
      });
      setIsComplete(docData.status === 'completed');
    }
  }, [docData, documentId]);

  const handleKeyPress = useCallback((e) => {
    if (e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      if (projectData?.entity_classes[index]) {
        setSelectedEntity(projectData.entity_classes[index]);
      }
    }
  }, [projectData]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const handleEntityClick = useCallback((e, index) => {
    e.stopPropagation();
    setFocusedEntityIndex(index);
    setAnchorEl(e.currentTarget);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setAnchorEl(null);
    setFocusedEntityIndex(null);
  }, []);

  const handleRemoveEntity = useCallback((index) => {
    const newEntities = [...entities];
    newEntities.splice(index, 1);
    setEntities(newEntities);
    
    setDocumentChanges(prev => {
      const formattedEntities = newEntities.map(entity => ({
        start: entity.start,
        end: entity.end,
        label: entity.label,
        text: entity.text
      }));

      const formattedAnnotations = newEntities.map(entity => ({
        start_index: entity.start,
        end_index: entity.end,
        entity: entity.label,
        text: entity.text
      }));

      return new Map(prev).set(documentId, {
        entities: formattedEntities,
        annotations: formattedAnnotations
      });
    });
    setUnsavedDocuments(prev => new Set(prev).add(documentId));
  }, [entities, documentId]);

  const handleClassChange = useCallback((entityClass) => {
    if (focusedEntityIndex !== null) {
      setEntities(prev => prev.map((entity, index) => {
        if (index === focusedEntityIndex) {
          return {
            ...entity,
            label: entityClass.name,
            color: entityClass.color
          };
        }
        return entity;
      }));
    }
    handlePopoverClose();
  }, [focusedEntityIndex, handlePopoverClose]);

  const handleTextSelection = useCallback(() => {
    if (!selectedEntity) return;

    const selection = window.getSelection();
    if (!selection.toString().trim()) return;

    const range = selection.getRangeAt(0);
    const textContent = textContentRef.current;

    if (!textContent.contains(range.startContainer) || !textContent.contains(range.endContainer)) {
      return;
    }

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(textContent);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;

    const end = start + range.toString().length;

    const newEntity = {
      start,
      end,
      label: selectedEntity.name,
      text: selection.toString(),
      color: selectedEntity.color
    };

    console.log('New entity:', newEntity);
    setEntities(prev => [...prev, newEntity]);
    selection.removeAllRanges();
    setUnsavedDocuments(prev => new Set(prev).add(documentId));
    setDocumentChanges(prev => {
      const existingChanges = prev.get(documentId) || {
        entities: [],
        annotations: []
      };

      const formattedEntity = {
        start: newEntity.start,
        end: newEntity.end,
        label: newEntity.label,
        text: newEntity.text
      };

      const formattedAnnotation = {
        start_index: newEntity.start,
        end_index: newEntity.end,
        entity: newEntity.label,
        text: newEntity.text
      };

      return new Map(prev).set(documentId, {
        entities: [...existingChanges.entities, formattedEntity],
        annotations: [...existingChanges.annotations, formattedAnnotation]
      });
    });
  }, [selectedEntity, documentId]);

  const handleEntitiesChange = useCallback((newEntities) => {
    setEntities(newEntities);
    // Update document changes while preserving existing annotations
    setDocumentChanges(prev => {
      const existingChanges = prev.get(documentId) || {
        entities: [],
        annotations: []
      };
      
      const formattedEntities = newEntities.map(entity => ({
        start: entity.start,
        end: entity.end,
        label: entity.label,
        text: entity.text
      }));

      const formattedAnnotations = newEntities.map(entity => ({
        start_index: entity.start,
        end_index: entity.end,
        entity: entity.label,
        text: entity.text
      }));

      return new Map(prev).set(documentId, {
        entities: formattedEntities,
        annotations: formattedAnnotations
      });
    });
    setUnsavedDocuments(prev => new Set(prev).add(documentId));
  }, [documentId]);

  const handleAddEntity = useCallback((newEntity) => {
    const formattedEntity = {
      start: newEntity.start,
      end: newEntity.end,
      label: newEntity.label,
      text: newEntity.text
    };

    const formattedAnnotation = {
      start_index: newEntity.start,
      end_index: newEntity.end,
      entity: newEntity.label,
      text: newEntity.text
    };

    setEntities(prev => [...prev, newEntity]);
    setDocumentChanges(prev => {
      const existingChanges = prev.get(documentId) || {
        entities: [],
        annotations: []
      };

      return new Map(prev).set(documentId, {
        entities: [...existingChanges.entities, formattedEntity],
        annotations: [...existingChanges.annotations, formattedAnnotation]
      });
    });
    setUnsavedDocuments(prev => new Set(prev).add(documentId));
  }, [documentId]);

  const handleSave = useCallback(async () => {
    try {
      const changes = documentChanges.get(documentId);
      if (!changes) return;

      await updateDocument(documentId, {
        entities: changes.entities,
        annotations: changes.annotations
      });

      setUnsavedDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
      setDocumentChanges(prev => {
        const newMap = new Map(prev);
        newMap.delete(documentId);
        return newMap;
      });
      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Error saving annotations:', error);
      toast.error('Failed to save annotations');
    }
  }, [documentId, documentChanges]);

  const handleSaveAll = useCallback(async () => {
    try {
      const unsavedDocIds = Array.from(unsavedDocuments);
      
      await Promise.all(
        unsavedDocIds.map(async (docId) => {
          const changes = documentChanges.get(docId);
          if (changes) {
            await updateDocument(docId, {
              entities: changes.entities,
              annotations: changes.annotations
            });
          }
        })
      );

      setUnsavedDocuments(new Set());
      setDocumentChanges(new Map());
      toast.success('All documents saved successfully');
      
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
    } catch (error) {
      console.error('Error saving all documents:', error);
      toast.error('Failed to save all documents');
    }
  }, [unsavedDocuments, documentChanges, pendingNavigation, navigate]);

  const handleMarkComplete = async () => {
    setIsComplete(!isComplete);
    try {
      await updateDocument(documentId, {
        ...docData,
        status: !isComplete ? 'completed' : 'in_progress'
      });
      toast.success(!isComplete ? 'Document marked as complete' : 'Document marked as in progress');
    } catch (error) {
      console.error('Error updating document status:', error);
      toast.error('Failed to update document status');
      setIsComplete(!isComplete); // revert the state if update fails
    }
  };

  const hasUnsavedChanges = unsavedDocuments.has(documentId);

  const navigateDocument = useCallback((direction) => {
    const currentIndex = projectDocuments.findIndex(doc => doc.id === documentId);
    const nextIndex = currentIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < projectDocuments.length) {
      const nextDoc = projectDocuments[nextIndex];
      
      if (autoSave && hasUnsavedChanges) {
        handleSave().then(() => {
          navigate(`/annotate/${nextDoc.id}`);
        });
      } else {
        navigate(`/annotate/${nextDoc.id}`);
      }
    }
  }, [projectDocuments, documentId, navigate, hasUnsavedChanges, autoSave, handleSave]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true);
      setPendingNavigation(() => () => navigate(`/projects/${docData.project_id}`));
    } else {
      navigate(`/projects/${docData.project_id}`);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedDocuments.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const unblock = () => {
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
    };

    const handleLocationChange = () => {
      const currentPath = location.pathname;
      if (!currentPath.includes('/annotate') && unsavedDocuments.size > 0) {
        setShowExitDialog(true);
        return false;
      }
      return true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsavedDocuments, location, navigate, pendingNavigation]);

  const handleNavigationAttempt = (path) => {
    if (!path.includes('/annotate') && unsavedDocuments.size > 0) {
      setPendingNavigation(path);
      setShowExitDialog(true);
      return;
    }
    navigate(path);
  };

  const handleExitConfirm = async (shouldSave) => {
    try {
      if (shouldSave) {
        await handleSaveAll();
      }
      setShowExitDialog(false);
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
    } catch (error) {
      console.error('Error during exit:', error);
      toast.error('Failed to save changes');
    }
  };

  const handleExitCancel = () => {
    setShowExitDialog(false);
    setPendingNavigation(null);
  };

  const renderedText = useMemo(() => {
    if (!docData?.text) return null;

    const text = docData.text;
    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);
    const result = [];
    let lastIndex = 0;

    console.log('Rendering text with entities:', sortedEntities);

    sortedEntities.forEach((entity, index) => {
      if (entity.start > lastIndex) {
        result.push(
          <span key={`text-${index}`}>
            {text.slice(lastIndex, entity.start)}
          </span>
        );
      }

      result.push(
        <mark
          key={`entity-${index}`}
          style={{
            backgroundColor: entity.color,
            padding: '2px 4px',
            margin: '0 1px',
            borderRadius: '3px',
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-block'
          }}
          onClick={(e) => handleEntityClick(e, index)}
        >
          {text.slice(entity.start, entity.end)}
          <IconButton
            size="small"
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              padding: 0,
              width: '16px',
              height: '16px',
              minWidth: '16px',
              minHeight: '16px',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              opacity: 0,
              transition: 'opacity 0.2s',
              '&:hover': {
                backgroundColor: '#f5f5f5',
                opacity: 1,
              },
              'mark:hover &': {
                opacity: 1,
              },
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveEntity(index);
            }}
          >
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </mark>
      );

      lastIndex = entity.end;
    });

    if (lastIndex < text.length) {
      result.push(
        <span key="text-end">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return result;
  }, [docData?.text, entities, handleEntityClick, handleRemoveEntity]);

  const filteredClasses = useMemo(() => {
    if (!projectData) return [];
    return projectData.entity_classes.filter(ec =>
      ec.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projectData, searchTerm]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Back to Project
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                />
              }
              label="AutoSave"
            />
            <Button
              variant="contained"
              color={isComplete ? "success" : "primary"}
              onClick={handleMarkComplete}
              startIcon={isComplete ? <CheckIcon /> : null}
            >
              {isComplete ? "Marked Complete" : "Mark as Complete"}
            </Button>
            {!autoSave && unsavedDocuments.size > 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveAll}
              >
                Save All
              </Button>
            )}
            <Button
              startIcon={<NavigateBeforeIcon />}
              onClick={() => navigateDocument(-1)}
              disabled={!projectDocuments.length || projectDocuments.findIndex(doc => doc.id === documentId) === 0}
            >
              Previous
            </Button>
            <Button
              endIcon={<NavigateNextIcon />}
              onClick={() => navigateDocument(1)}
              disabled={!projectDocuments.length || projectDocuments.findIndex(doc => doc.id === documentId) === projectDocuments.length - 1}
            >
              Next
            </Button>
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Entity Classes (1-9 keys to select):
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {projectData?.entity_classes.map((ec, index) => (
              <Chip
                key={index}
                label={`${index + 1}. ${ec.name}`}
                sx={{
                  backgroundColor: ec.color,
                  cursor: 'pointer',
                  border: selectedEntity?.name === ec.name ? '2px solid black' : 'none',
                  '&:hover': {
                    opacity: 0.8,
                  },
                }}
                onClick={() => setSelectedEntity(ec)}
              />
            ))}
          </Box>
        </Box>

        <Box
          ref={textContentRef}
          sx={{
            p: 2,
            border: '1px solid #ccc',
            borderRadius: 1,
            minHeight: '200px',
            whiteSpace: 'pre-wrap',
            backgroundColor: '#f5f5f5',
            cursor: 'text',
            lineHeight: 1.8,
            '& mark': {
              textDecoration: 'none',
            },
          }}
          onMouseUp={handleTextSelection}
        >
          {renderedText}
        </Box>
      </Paper>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 1, width: 250 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <List dense>
            {filteredClasses.map((ec, index) => (
              <ListItem
                key={index}
                button
                onClick={() => handleClassChange(ec)}
              >
                <ListItemText
                  primary={ec.name}
                  secondary={
                    <Box
                      component="span"
                      sx={{
                        width: 16,
                        height: 16,
                        backgroundColor: ec.color,
                        display: 'inline-block',
                        borderRadius: '50%',
                        marginRight: 1,
                      }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>

      {/* Exit Confirmation Dialog */}
      <Dialog
        open={showExitDialog}
        onClose={() => {
          setShowExitDialog(false);
          setPendingNavigation(null);
        }}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have unsaved changes. Would you like to save them before leaving?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setShowExitDialog(false);
              setPendingNavigation(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (pendingNavigation) {
                pendingNavigation();
              }
              setShowExitDialog(false);
              setPendingNavigation(null);
            }}
          >
            Don't Save
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              await handleSaveAll();
              if (pendingNavigation) {
                pendingNavigation();
              }
              setShowExitDialog(false);
              setPendingNavigation(null);
            }}
          >
            Save & Exit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnotationTool;
