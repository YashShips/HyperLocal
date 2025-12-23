
import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Typography, Modal, IconButton, Avatar } from '@mui/material';
import { Phone, PhoneDisabled, Videocam } from '@mui/icons-material';
import SimplePeer from 'simple-peer';

const VideoCallInterface = ({ socket, currentUser, otherUser }) => {
    const [stream, setStream] = useState(null);
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState('');
    const [callerSignal, setCallerSignal] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [callActive, setCallActive] = useState(false);

    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();

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

    const startLocalStream = async () => {
        try {
            const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(currentStream);
            if (myVideo.current) {
                myVideo.current.srcObject = currentStream;
                myVideo.current.play().catch(e => console.log('Local video play error:', e));
            }
            return currentStream;
        } catch (err) {
            console.error("Error accessing media devices:", err);
            return null;
        }
    };

    const callUser = async () => {
        const currentStream = await startLocalStream();
        if (!currentStream) return;

        setCallActive(true);
        setCallEnded(false);

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
            console.log('Received remote stream:', remoteStream);
            if (userVideo.current) {
                userVideo.current.srcObject = remoteStream;
                userVideo.current.play().catch(e => console.log('Video play error:', e));
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

        const peer = new SimplePeer({
            initiator: false,
            trickle: false,
            stream: currentStream
        });

        peer.on('signal', (data) => {
            socket.emit('answerCall', { signal: data, to: caller });
        });

        peer.on('stream', (remoteStream) => {
            console.log('Received remote stream:', remoteStream);
            if (userVideo.current) {
                userVideo.current.srcObject = remoteStream;
                userVideo.current.play().catch(e => console.log('Video play error:', e));
            }
        });

        peer.signal(callerSignal);
        connectionRef.current = peer;
    };

    const leaveCall = () => {
        setCallEnded(true);
        setCallActive(false);

        if (connectionRef.current) {
            connectionRef.current.destroy();
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        socket.emit('endCall', { to: callAccepted ? otherUser._id : caller });
        window.location.reload(); // Simple way to clean up peer connection state completely
    };

    return (
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {!callActive && !receivingCall && (
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Videocam />}
                    onClick={callUser}
                >
                    Video Call
                </Button>
            )}

            {/* Incoming Call Modal */}
            <Modal open={receivingCall && !callAccepted} onClose={() => setReceivingCall(false)}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 300, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2,
                    textAlign: 'center'
                }}>
                    <Typography variant="h6" gutterBottom>Incoming Video Call</Typography>
                    <Typography variant="body1" gutterBottom>
                        ... is calling you
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-around' }}>
                        <Button variant="contained" color="success" onClick={answerCall}>
                            Answer
                        </Button>
                        <Button variant="contained" color="error" onClick={() => setReceivingCall(false)}>
                            Decline
                        </Button>
                    </Box>
                </Box>
            </Modal>

            {/* Video Call Interface */}
            <Modal open={callActive} onClose={() => { }}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '90%', maxWidth: 800, bgcolor: '#1a1a1a', boxShadow: 24, p: 2, borderRadius: 2,
                    display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                    <Box sx={{ display: 'flex', width: '100%', gap: 2, mb: 2, flexDirection: { xs: 'column', md: 'row' } }}>
                        {/* My Video */}
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            <video
                                playsInline
                                muted
                                ref={myVideo}
                                autoPlay
                                style={{ width: '100%', borderRadius: '8px', border: '2px solid #333' }}
                            />
                            <Typography sx={{ position: 'absolute', bottom: 8, left: 8, color: 'white', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1 }}>
                                You
                            </Typography>
                        </Box>

                        {/* User Video */}
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            {callAccepted && !callEnded ? (
                                <video
                                    playsInline
                                    ref={userVideo}
                                    autoPlay
                                    style={{ width: '100%', borderRadius: '8px', border: '2px solid #333' }}
                                />
                            ) : (
                                <Box sx={{ width: '100%', height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#333', borderRadius: 2 }}>
                                    <Typography color="white">Calling...</Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<PhoneDisabled />}
                        onClick={leaveCall}
                        size="large"
                    >
                        End Call
                    </Button>
                </Box>
            </Modal>
        </Box>
    );
};

export default VideoCallInterface;
