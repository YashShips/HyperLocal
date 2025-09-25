import React, { useState, useContext } from 'react';
import { Card, CardContent, Typography, Box, TextField, Button, Divider } from '@mui/material';
import CommentList from './CommentList';
import { AuthContext } from '../context/AuthContext';

// Accept onCommentDeleted as a prop
function PostCard({ post, onCommentAdded, onCommentDeleted }) {
  const [commentText, setCommentText] = useState('');
  const { user } = useContext(AuthContext);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onCommentAdded(post._id, commentText);
    setCommentText('');
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          Posted by: {post.author ? post.author.username : 'Anonymous'}
        </Typography>
        <Typography variant="body1" sx={{ my: 1 }}>
          {post.content}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDate(post.createdAt)}
        </Typography>
        
        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
          Comments
        </Typography>
        {/* Pass the function down to CommentList */}
        <CommentList comments={post.comments} onCommentDeleted={onCommentDeleted} />

        {user && ( // Only show comment form if user is logged in
            <Box component="form" onSubmit={handleCommentSubmit} sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <TextField
                    size="small"
                    variant="outlined"
                    placeholder="Write a comment..."
                    fullWidth
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                />
                <Button type="submit" variant="contained" size="small">
                    Add
                </Button>
            </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default PostCard;