import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

// Add request interceptor to handle errors globally
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Project APIs
export const createProject = async (projectData) => {
  try {
    const response = await axios.post(`${API_URL}/projects/`, projectData);
    return response.data;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

export const getProjects = async () => {
  try {
    const response = await axios.get(`${API_URL}/projects/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

export const getProject = async (projectId) => {
  try {
    const response = await axios.get(`${API_URL}/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
};

export const updateProject = async (projectId, projectData) => {
  try {
    console.log('Updating project:', projectId, 'with data:', projectData);
    const response = await axios.put(`${API_URL}/projects/${projectId}`, projectData);
    console.log('Project update response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const response = await axios.delete(`${API_URL}/projects/${projectId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Document APIs
export const createDocument = async (documentData) => {
  try {
    console.log('Creating document with data:', documentData);
    const response = await axios.post(`${API_URL}/documents`, documentData);
    console.log('Created document:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

export const uploadDocument = async (projectId, files) => {
  try {
    console.log('Uploading documents for project:', projectId);
    const formData = new FormData();
    
    // Handle both single file and multiple files
    if (Array.isArray(files)) {
      files.forEach(file => formData.append('files', file));
    } else {
      formData.append('files', files);
    }
    formData.append('project_id', projectId);
    
    const response = await axios.post(
      `${API_URL}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    console.log('Upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error uploading documents:', error);
    throw error;
  }
};

export const getProjectDocuments = async (projectId, params = { page: 1, docsPerPage: 5 }) => {
  try {
    console.log('Fetching documents with params:', params);
    const url = `${API_URL}/documents/project/${projectId}`;  
    const response = await axios.get(url, {
      params: {
        page: params.page,
        docsPerPage: params.docsPerPage
      }
    });
    console.log(`Fetched ${response.data.length} documents from ${url}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching project documents:', error);
    throw error;
  }
};

export const getDocument = async (documentId) => {
  try {
    if (!documentId || typeof documentId !== 'string') {
      throw new Error('Invalid document ID');
    }

    const response = await axios.get(`${API_URL}/documents/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching document:', error);
    if (error.message === 'Invalid document ID') {
      throw new Error('Invalid document ID format');
    }
    throw error;
  }
};

export const updateDocument = async (documentId, documentData) => {
  try {
    const response = await axios.put(`${API_URL}/documents/${documentId}`, documentData);
    return response.data;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

export const bulkDeleteDocuments = async (documentIds) => {
  try {
    const response = await axios.delete(`${API_URL}/documents/bulk-delete`, {
      data: { document_ids: documentIds }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const exportProjectData = async (projectId) => {
  try {
    const response = await axios.get(`${API_URL}/projects/${projectId}/export`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting project data:', error);
    throw error;
  }
};

export const autoAnnotateDocument = async (projectId, documentId) => {
  try {
    const response = await fetch(`${API_URL}/auto/project/${projectId}/document/${documentId}/auto_annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (!response.ok) {
      throw new Error('Failed to auto-annotate document');
    }
    return await response.json();
  } catch (error) {
    console.error('Error auto-annotating document:', error);
    throw error;
  }
};
