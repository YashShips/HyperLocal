import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Container, Typography, Box } from '@mui/material';
import CreatePostForm from '../components/CreatePostForm';
import PostCard from '../components/PostCard';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api/posts';
const SOCKET_URL = 'http://localhost:5000';

function HomePage() {
  const [posts, setPosts] = useState([]);
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchPosts = async () => {
      const response = await axios.get(API_URL);
      setPosts(response.data);
    };
    fetchPosts();

    const socket = io(SOCKET_URL);
    
    socket.on('post_created', (newPost) => {
      setPosts((prevPosts) => [newPost, ...prevPosts]);
    });

    socket.on('comment_added', (data) => {
      setPosts((prevPosts) => 
        prevPosts.map((post) => 
          post._id === data.postId 
            ? { ...post, comments: [...post.comments, data.comment] } 
            : post
        )
      );
    });

    // New socket listener for deleted comments
    socket.on('comment_deleted', (data) => {
      setPosts((prevPosts) => 
        prevPosts.map((post) => {
          if (post._id !== data.postId) return post;
          return {
            ...post,
            comments: post.comments.map((comment) => 
              comment._id === data.commentId 
                ? { ...comment, text: '[message deleted]', isDeleted: true }
                : comment
            )
          };
        })
      );
    });

    return () => socket.disconnect();
  }, [token, navigate]);

  const authHeader = { headers: { 'x-auth-token': token } };

  const handlePostCreated = async (content) => {
    await axios.post(API_URL, { content }, authHeader);
  };

  const handleCommentAdded = async (postId, text) => {
    await axios.post(`${API_URL}/${postId}/comments`, { text }, authHeader);
  };

  // New handler for deleting comments
  const handleCommentDeleted = async (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      await axios.delete(`${API_URL}/comments/${commentId}`, authHeader);
    }
  };

  return (
    <Container maxWidth="md">
      {user && ( // Only show the main content if the user is logged in
        <>
            <Box sx={{ my: 4 }}>
                <CreatePostForm onPostCreated={handlePostCreated} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {posts.map((post) => (
                <PostCard 
                    key={post._id} 
                    post={post}
                    onCommentAdded={handleCommentAdded}
                    onCommentDeleted={handleCommentDeleted} // Pass the delete handler
                />
                ))}
            </Box>
        </>
      )}
    </Container>
  );
}

export default HomePage;