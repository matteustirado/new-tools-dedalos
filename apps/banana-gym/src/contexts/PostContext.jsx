import React, { createContext, useState, useContext } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

const PostContext = createContext();

export function PostProvider({ children }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadPost = async (formData, isArchived) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const res = await api.post('/api/gym/checkin', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted < 100 ? percentCompleted : 95);
        }
      });

      if (isArchived && res.data.checkin_id) {
        await api.put(`/api/gym/post/${res.data.checkin_id}/archive`, { 
          colaborador_cpf: formData.get('colaborador_cpf') 
        });
      }

      setUploadProgress(100);
      
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Erro de conexão ao publicar.');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 2000);
    }
  };

  return (
    <PostContext.Provider value={{ isUploading, uploadProgress, uploadPost }}>
      {children}
    </PostContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePost = () => useContext(PostContext);