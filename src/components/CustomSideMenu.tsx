import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { logout as logoutApi, getCurrentSystemSettings } from '../api/endpoints';
import { SystemSettings } from '../types';
import { usePeriodTimer } from '../hooks/usePeriodTimer';

interface MenuItem {
  label: string;
  screenName: string;
  adminOnly?: boolean;
}

interface CustomSideMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function CustomSideMenu({ visible, onClose }: CustomSideMenuProps) {
  const navigation = useNavigation();
  const { user, refreshToken, isSessionAuth, logout: logoutStore } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const periodInfo = usePeriodTimer(settings);

  console.log('🔍 User role:', user?.role);
  console.log('🔍 Is admin:', isAdmin);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getCurrentSystemSettings();
        setSettings(data);
      } catch (error) {
        console.error('Error loading system settings:', error);
      }
    };
    
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      setShowLogoutModal(false);
      // Web: session logout (bez tokena), Mobile: JWT logout (s refresh tokenom)
      if (isSessionAuth) {
        await logoutApi();
      } else if (refreshToken) {
        await logoutApi(refreshToken);
      }
    } catch (error) {
      console.log('Logout API error:', error);
    } finally {
      await logoutStore();
      setIsLoggingOut(false);
      onClose();
    }
  };

  const menuItems: MenuItem[] = [
    { label: 'Početna', screenName: 'Početna' },
    { label: 'Korisnici', screenName: 'Korisnici' },
    { label: 'Izložbe', screenName: 'Izložbe' },
    { label: 'Bodovi', screenName: 'Bodovi' },
    { label: 'Konfiguracija', screenName: 'Konfiguracija' },
    { label: 'Povijest upisivanja', screenName: 'Povijest upisivanja' },
    { label: 'Prijave recepciji', screenName: 'Prijave recepciji' },
    { label: 'Postavke sustava', screenName: 'Postavke sustava' },
    
    // Admin only
    { label: 'Admin obavijesti', screenName: 'Administratorske obavijesti', adminOnly: true },
    { label: 'Povijest promjena', screenName: 'Povijest promjena sustava', adminOnly: true },
  ];

  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={isLoggingOut ? undefined : onClose}
      >
        <View style={styles.menuContainer}>
          {isLoggingOut && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0A3323" />
                <Text style={styles.loadingText}>Odjava u tijeku...</Text>
              </View>
            </View>
          )}
          <ScrollView style={styles.scrollView} scrollEnabled={!isLoggingOut}>
            {/* User Info */}
            {(() => {
              const bg = periodInfo?.color || '#F7F4D5';
              const textColor = (bg === '#105666' || bg === '#0A3323')
                ? '#F7F4D5'
                : bg === '#A6C27A'
                  ? '#105666'
                  : '#0A3323';
              return (
                <View style={[styles.userInfo, { backgroundColor: bg }]}>
                  <Text style={[styles.userName, { color: textColor }]}>{user?.full_name || user?.username}</Text>
                  <Text style={[styles.userRole, { color: textColor }]}>
                    {user?.role === 'admin' ? 'Administrator' : 'Čuvar'}
                  </Text>
                </View>
              );
            })()}

            {/* Menu Items */}
            {filteredItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => {
                  navigation.navigate(item.screenName as never);
                  onClose();
                }}
                disabled={isLoggingOut}
              >
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            {/* Logout */}
            <TouchableOpacity
              style={[styles.menuItem, styles.logoutItem]}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <Text style={[styles.menuLabel, styles.logoutText]}>Odjava</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <Text style={styles.logoutModalTitle}>Odjava</Text>
            <Text style={styles.logoutModalMessage}>
              Jeste li sigurni da se želite odjaviti?
            </Text>
            
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutCancelButton]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutConfirmButton]}
                onPress={confirmLogout}
              >
                <Text style={styles.logoutConfirmButtonText}>Odjavi se</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'flex-start',
  },
  menuContainer: {
    width: '75%',
    height: '100%',
    backgroundColor: '#F7F4D5',
    shadowColor: '#0A3323',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  userInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0A3323',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0A3323',
    marginTop: 10,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#0A3323',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#A6C27A',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
  },
  menuLabel: {
    fontSize: 16,
    color: '#0A3323',
    fontWeight: '700',
  },
  logoutItem: {
    marginTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#A6C27A',
  },
  logoutText: {
    color: '#0A3323',
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(247, 244, 213, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#F7F4D5',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#A6C27A',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#0A3323',
    fontWeight: '600',
  },
  // Custom Logout Modal stilovi
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 15,
    padding: 25,
    width: '85%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#A6C27A',
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A3323',
    marginBottom: 15,
    textAlign: 'center',
  },
  logoutModalMessage: {
    fontSize: 16,
    color: '#0A3323',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutCancelButton: {
    backgroundColor: '#F7F4D5',
    borderWidth: 1,
    borderColor: '#0A3323',
  },
  logoutCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3323',
  },
  logoutConfirmButton: {
    backgroundColor: '#A6C27A',
    borderWidth: 1,
    borderColor: '#0A3323',
  },
  logoutConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A3323',
  },
});
