
import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Modal, IconButton, Avatar } from '@mui/material';
import { Phone, PhoneDisabled, Call } from '@mui/icons-material';
import SimplePeer from 'simple-peer';

const VoiceCallInterface = ({ socket, currentUser, otherUser }) => {
    const [stream, setStream] = useState(null);
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState('');
    const [callerSignal, setCallerSignal] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [callActive, setCallActive] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    const audioRef = useRef();
    const connectionRef = useRef();
    const timerRef = useRef();

    useEffect(() => {
        if (!socket) return;

        // Listen for incoming calls
        socket.on('callUser', (data) => {
            setReceivingCall(true);
            setCaller(data.from);
            setCallerSignal(data.signal);
        });

        // Listen for call ended
        socket.on('callEnded', () => {
            setCallEnded(true);
            setCallActive(false);
            setReceivingCall(false);
            if (connectionRef.current) connectionRef.current.destroy();
            if (timerRef.current) clearInterval(timerRef.current);
            // Stop local stream tracks
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        });

        return () => {
            socket.off('callUser');
            socket.off('callEnded');
        };
    }, [socket, stream]);

    // Call duration timer
    useEffect(() => {
        if (callAccepted && !callEnded) {
            timerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callAccepted, callEnded]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startLocalStream = async () => {
        try {
            // Audio only - no video
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            setStream(currentStream);
            return currentStream;
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check your permissions.");
            return null;
        }
    };

    const callUser = async () => {
        const currentStream = await startLocalStream();
        if (!currentStream) return;

        setCallActive(true);
        setCallEnded(false);
        setCallDuration(0);

        const peer = new SimplePeer({
            initiator: true,
            trickle: false,
            stream: currentStream
        });

        peer.on('signal', (data) => {
            socket.emit('callUser', {
                userToCall: otherUser._id,
                signalData: data,
                fromUser: currentUser.id,
                name: currentUser.name
            });
        });

        peer.on('stream', (remoteStream) => {
            console.log('Received remote audio stream');
            if (audioRef.current) {
                audioRef.current.srcObject = remoteStream;
                audioRef.current.play().catch(e => console.log('Audio play error:', e));
            }
        });

        socket.on('callAccepted', (signal) => {
            setCallAccepted(true);
            peer.signal(signal);
        });

        connectionRef.current = peer;
    };

    const answerCall = async () => {
        const currentStream = await startLocalStream();
        if (!currentStream) return;

        setCallAccepted(true);
        setCallActive(true);
        setCallDuration(0);

        const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: currentStream
        });

        peer.on('signal', (data) => {
            socket.emit('answerCall', { signal: data, to: caller });
        });

        peer.on('stream', (remoteStream) => {
            console.log('Received remote audio stream');
            if (audioRef.current) {
                audioRef.current.srcObject = remoteStream;
                audioRef.current.play().catch(e => console.log('Audio play error:', e));
            }
        });

        peer.signal(callerSignal);
        connectionRef.current = peer;
    };

    const leaveCall = () => {
        setCallEnded(true);
        setCallActive(false);
        setCallDuration(0);

        if (timerRef.current) clearInterval(timerRef.current);

        if (connectionRef.current) {
            connectionRef.current.destroy();
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        socket.emit('endCall', { to: callAccepted ? otherUser._id : caller });
        setCallAccepted(false);
        setReceivingCall(false);
    };

    return (
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {/* Hidden audio element for remote audio */}
            <audio ref={audioRef} autoPlay />

            {!callActive && !receivingCall && (
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Call />}
                    onClick={callUser}
                >
                    Voice Call
                </Button>
            )}

            {/* Incoming Call Modal */}
            <Modal open={receivingCall && !callAccepted} onClose={() => setReceivingCall(false)}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 300, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2,
                    textAlign: 'center'
                }}>
                    <Box sx={{ mb: 2 }}>
                        <Avatar sx={{ width: 60, height: 60, margin: '0 auto', bgcolor: 'primary.main' }}>
                            <Call sx={{ fontSize: 30 }} />
                        </Avatar>
                    </Box>
                    <Typography variant="h6" gutterBottom>Incoming Voice Call</Typography>
                    <Typography variant="body1" color="text.secondary" gutterBottom>
                        Someone is calling you...
                    </Typography>
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-around' }}>
                        <IconButton
                            onClick={answerCall}
                            sx={{
                                bgcolor: 'success.main',
                                color: 'white',
                                '&:hover': { bgcolor: 'success.dark' },
                                width: 56,
                                height: 56
                            }}
                        >
                            <Call />
                        </IconButton>
                        <IconButton
                            onClick={() => setReceivingCall(false)}
                            sx={{
                                bgcolor: 'error.main',
                                color: 'white',
                                '&:hover': { bgcolor: 'error.dark' },
                                width: 56,
                                height: 56
                            }}
                        >
                            <PhoneDisabled />
                        </IconButton>
                    </Box>
                </Box>
            </Modal>

            {/* Active Call Modal */}
            <Modal open={callActive} onClose={() => { }}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 320, bgcolor: '#1a1a1a', boxShadow: 24, p: 4, borderRadius: 3,
                    display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                    {/* User Avatar */}
                    <Avatar sx={{ width: 80, height: 80, mb: 2, bgcolor: 'primary.main' }}>
                        {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>

                    {/* User Name */}
                    <Typography variant="h6" color="white" gutterBottom>
                        {otherUser?.name || 'Unknown User'}
                    </Typography>

                    {/* Call Status */}
                    <Typography variant="body2" color="grey.400" sx={{ mb: 3 }}>
                        {callAccepted && !callEnded ? formatDuration(callDuration) : 'Calling...'}
                    </Typography>

                    {/* Call animation indicator */}
                    {callAccepted && !callEnded && (
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 3 }}>
                            {[0, 1, 2].map((i) => (
                                <Box
                                    key={i}
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        bgcolor: 'success.main',
                                        borderRadius: '50%',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                        animationDelay: `${i * 0.2}s`,
                                        '@keyframes pulse': {
                                            '0%, 100%': { opacity: 0.3, transform: 'scale(1)' },
                                            '50%': { opacity: 1, transform: 'scale(1.2)' }
                                        }
                                    }}
                                />
                            ))}
                        </Box>
                    )}

                    {/* End Call Button */}
                    <IconButton
                        onClick={leaveCall}
                        sx={{
                            bgcolor: 'error.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'error.dark' },
                            width: 64,
                            height: 64
                        }}
                    >
                        <PhoneDisabled sx={{ fontSize: 28 }} />
                    </IconButton>
                </Box>
            </Modal>
        </Box>
    );
};

export default VoiceCallInterface;
