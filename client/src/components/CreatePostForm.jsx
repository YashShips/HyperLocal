import React, { useState } from 'react';
import { Card, TextField, Button, Box } from '@mui/material';

function CreatePostForm({ onPostCreated }) {
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return; // Don't post empty content
    onPostCreated(content);
    setContent(''); // Clear the form
  };

  return (
    <Card sx={{ p: 2 }}>
      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          label="What's on your mind?"
          multiline
          rows={3}
          variant="outlined"
          fullWidth
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          sx={{ mt: 2 }}
          fullWidth
        >
          Post
        </Button>
      </Box>
    </Card>
  );
}

export default CreatePostForm;