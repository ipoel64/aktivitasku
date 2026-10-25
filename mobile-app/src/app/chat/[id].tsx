import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setupChat();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`room:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${id}`
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function setupChat() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Jika ini dummy room, tampilkan pesan sambutan fiktif
      if (id === 'dummy-room') {
        setMessages([
          { id: '1', sender_id: 'teacher', content: 'Halo, ada yang bisa Bapak/Ibu bantu terkait aktivitas hari ini?', sent_at: new Date().toISOString() }
        ]);
        setLoading(false);
        return;
      }

      // Ambil riwayat pesan dari database
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', id)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.log('Error setup chat:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !userId) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // optimistically clear input

    if (id === 'dummy-room') {
      // Simulate real-time for dummy room
      const dummyMsg = {
        id: Date.now().toString(),
        sender_id: userId,
        content: messageText,
        sent_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, dummyMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: id,
          sender_id: userId,
          content: messageText
        });
        
      if (error) throw error;
    } catch (error) {
      console.log('Error sending message:', error);
    }
  }

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === userId;
    
    return (
      <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
          {item.content}
        </Text>
        <Text style={styles.timeText}>
          {new Date(item.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#6bd8cb" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{name || 'Ruang Obrolan'}</Text>
          <Text style={styles.headerSubtitle}>Online</Text>
        </View>
      </View>

      {/* Chat Area */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0d9488" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
        />
      )}

      {/* Input Area */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Ketik pesan..."
          placeholderTextColor="#899391"
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1413',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#1b2120',
    borderBottomWidth: 1,
    borderBottomColor: '#3d4947',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#dee4e1',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#0d9488',
    fontSize: 12,
  },
  chatContainer: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0d9488',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b2120',
    borderWidth: 1,
    borderColor: '#3d4947',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    marginBottom: 4,
  },
  myMessageText: {
    color: 'white',
  },
  theirMessageText: {
    color: '#dee4e1',
  },
  timeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    alignSelf: 'flex-end',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#1b2120',
    borderTopWidth: 1,
    borderTopColor: '#3d4947',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f1413',
    color: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    minHeight: 40,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#3d4947',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  }
});
