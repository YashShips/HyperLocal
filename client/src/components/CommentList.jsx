import React, { useContext, useState, useEffect } from 'react';
import { Box, Typography, Divider, IconButton, Button, CircularProgress } from '@mui/material';
import { Add, Refresh } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { api } from '../context/AuthContext';
import CommentItem from './CommentItem';
import ReplyForm from './ReplyForm';

function CommentList({ postId, comments: initialComments, onCommentDeleted, onCommentAdded }) {
  const { user, socket } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [comments, setComments] = useState(initialComments || []);
  const [isLoading, setIsLoading] = useState(false);
  const [showMainCommentForm, setShowMainCommentForm] = useState(false);

  useEffect(() => {
    if (initialComments) {
      setComments(initialComments);
    }
  }, [initialComments]);

  // Socket subscription for real-time updates using shared socket
  useEffect(() => {
    if (!socket) return;

    const handleCommentAdded = (data) => {
      // Only update if the comment is for this post
      if (data.postId === postId) {
        setComments(prev => {
          // Helper to check if comment exists in list
          const commentExists = (list, id) => {
            for (const c of list) {
              if (c._id === id) return true;
              if (c.replies && commentExists(c.replies, id)) return true;
            }
            return false;
          };

          // Skip if comment already exists (prevents duplicates)
          if (commentExists(prev, data.comment._id)) {
            return prev;
          }

          if (data.parentId) {
            // It's a reply - add it to the parent comment
            const addReplyToComments = (commentList) => {
              return commentList.map(comment => {
                if (comment._id === data.parentId) {
                  // Check if reply already exists
                  const replyExists = (comment.replies || []).some(r => r._id === data.comment._id);
                  if (replyExists) return comment;
                  return {
                    ...comment,
                    replies: [...(comment.replies || []), data.comment],
                    replyCount: (comment.replyCount || 0) + 1
                  };
                } else if (comment.replies && comment.replies.length > 0) {
                  return {
                    ...comment,
                    replies: addReplyToComments(comment.replies)
                  };
                }
                return comment;
              });
            };
            return addReplyToComments(prev);
          } else {
            // It's a top-level comment
            return [data.comment, ...prev];
          }
        });
        onCommentAdded?.(data.comment);
      }
    };

    const handleCommentDeleted = (data) => {
      if (data.postId === postId) {
        const removeComment = (commentList) => {
          return commentList
            .filter(comment => comment._id !== data.commentId)
            .map(comment => ({
              ...comment,
              replies: comment.replies ? removeComment(comment.replies) : []
            }));
        };
        setComments(prev => removeComment(prev));
        onCommentDeleted?.(data.commentId);
      }
    };

    socket.on('comment_added', handleCommentAdded);
    socket.on('comment_deleted', handleCommentDeleted);

    return () => {
      socket.off('comment_added', handleCommentAdded);
      socket.off('comment_deleted', handleCommentDeleted);
    };
  }, [socket, postId, onCommentAdded, onCommentDeleted]);

  // Fetch comments from API
  const fetchComments = async () => {
    if (!postId) return;

    setIsLoading(true);
    try {
      const response = await api.get(`/posts/${postId}/comments`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reply added
  const handleReplyAdded = (newReply, parentId) => {
    const addReplyToComments = (commentList) => {
      return commentList.map(comment => {
        if (comment._id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), newReply],
            replyCount: (comment.replyCount || 0) + 1
          };
        } else if (comment.replies && comment.replies.length > 0) {
          return {
            ...comment,
            replies: addReplyToComments(comment.replies)
          };
        }
        return comment;
      });
    };

    setComments(prev => addReplyToComments(prev));
    onCommentAdded?.(newReply);
  };

  // Handle comment deleted
  const handleCommentDeleted = (commentId) => {
    const removeComment = (commentList) => {
      return commentList.filter(comment => comment._id !== commentId);
    };

    setComments(prev => removeComment(prev));
    onCommentDeleted?.(commentId);
  };

  // Handle reply deleted
  const handleReplyDeleted = (replyId, parentId) => {
    const removeReply = (commentList) => {
      return commentList.map(comment => {
        if (comment._id === parentId) {
          return {
            ...comment,
            replies: (comment.replies || []).filter(reply => reply._id !== replyId),
            replyCount: Math.max(0, (comment.replyCount || 0) - 1)
          };
        } else if (comment.replies && comment.replies.length > 0) {
          return {
            ...comment,
            replies: removeReply(comment.replies)
          };
        }
        return comment;
      });
    };

    setComments(prev => removeReply(prev));
    onCommentDeleted?.(replyId);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      {/* Comments Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: theme === 'dark' ? 'text.primary' : 'text.primary' }}>
          Comments ({comments.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" onClick={fetchComments} disabled={isLoading}>
            <Refresh fontSize="small" />
          </IconButton>
          {user && !showMainCommentForm && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setShowMainCommentForm(true)}
              sx={{ textTransform: 'none' }}
            >
              Add Comment
            </Button>
          )}
        </Box>
      </Box>

      {/* Main Comment Form */}
      {showMainCommentForm && (
        <Box sx={{ mb: 3 }}>
          <ReplyForm
            postId={postId}
            onReplyAdded={(newComment) => {
              setComments(prev => [newComment, ...prev]);
              setShowMainCommentForm(false);
              onCommentAdded?.(newComment);
            }}
            onCancel={() => setShowMainCommentForm(false)}
            placeholder="Write a comment..."
          />
        </Box>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 2,
            fontStyle: 'italic',
            textAlign: 'center',
            py: 4
          }}
        >
          No comments yet. Be the first to comment!
        </Typography>
      ) : (
        <Box>
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              postId={postId}
              onReplyAdded={(newReply) => handleReplyAdded(newReply, comment._id)}
              onCommentDeleted={(replyId) => handleReplyDeleted(replyId, comment._id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default CommentList;
