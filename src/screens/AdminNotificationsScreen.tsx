import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  AdminNotification,
  AdminNotificationCreateData,
  AdminNotificationCastType,
  ShiftType,
  Exhibition,
  User,
} from '../types';
import {
  getAdminNotifications,
  createAdminNotification,
  updateAdminNotification,
  deleteAdminNotification,
  getExhibitions,
  getUsers,
} from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

type CreateStep = 'cast_type' | 'filters' | 'content';
type SortField = 'expires_at' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function AdminNotificationsScreen() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [next, setNext] = useState<string | null>(null);
  const [prev, setPrev] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  
  // Filter & Sort state
  const [activeFilter, setActiveFilter] = useState<boolean>(true); // Admin vidi samo aktivne default
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showActiveDropdown, setShowActiveDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  
  // Temp state za filter modal (primjenjuje se tek na "Primijeni")
  const [tempActiveFilter, setTempActiveFilter] = useState<boolean>(true);
  const [tempSortField, setTempSortField] = useState<SortField>('created_at');
  const [tempSortOrder, setTempSortOrder] = useState<SortOrder>('desc');
  
  // Podaci za dropdowne
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [guards, setGuards] = useState<User[]>([]);
  
  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  
  // Create modal step
  const [createStep, setCreateStep] = useState<CreateStep>('cast_type');
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExpiresDatePicker, setShowExpiresDatePicker] = useState(false);
  
  // Dropdown states
  const [showExhibitionDropdown, setShowExhibitionDropdown] = useState(false);
  const [showGuardDropdown, setShowGuardDropdown] = useState(false);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<AdminNotificationCreateData>({
    title: '',
    message: '',
    cast_type: 'broadcast',
    to_user_id: null,
    notification_date: null,
    shift_type: null,
    exhibition_id: null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Default: 7 dana
  });

  // Funkcije za filter modal
  const openFiltersModal = () => {
    setTempActiveFilter(activeFilter);
    setTempSortField(sortField);
    setTempSortOrder(sortOrder);
    setShowFiltersModal(true);
  };

  const applyFilters = () => {
    setActiveFilter(tempActiveFilter);
    setSortField(tempSortField);
    setSortOrder(tempSortOrder);
    setShowFiltersModal(false);
  };

  const cancelFilters = () => {
    setShowFiltersModal(false);
  };

  useEffect(() => {
    loadNotifications();
    if (isAdmin) {
      loadExhibitions();
      loadGuards();
    }
  }, [isAdmin]);

  // Reload when filters or sort changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      loadNotifications(1);
    }
  }, [activeFilter, sortField, sortOrder]);

  const loadNotifications = async (pageNum: number = page) => {
    try {
      setLoading(true);
      
      // Build filters for backend
      const filters: any = {};
      
      // Admin može vidjeti samo aktivne notifikacije
      if (isAdmin && activeFilter) {
        filters.active = true;
      }
      
      // Ordering
      const orderingField = sortField === 'expires_at' ? 'expires_at' : 'created_at';
      filters.ordering = sortOrder === 'desc' ? `-${orderingField}` : orderingField;
      
      const data = await getAdminNotifications(pageNum, filters);
      
      // Extract results from paginated response
      const notificationsList = Array.isArray(data) ? data : (data.results || []);
      setNotifications(notificationsList);
      
      // Set pagination data
      if (!Array.isArray(data)) {
        setNext(data.next || null);
        setPrev(data.previous || null);
        setCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Greška', 'Nije moguće učitati obavijesti');
    } finally {
      setLoading(false);
    }
  };

  const loadExhibitions = async () => {
    try {
      const data = await getExhibitions();
      // Extract results from paginated response
      const exhibitionsList = Array.isArray(data) ? data : (data.results || []);
      // Filtriraj samo aktivne izložbe
      const activeExhibitions = exhibitionsList.filter((ex: Exhibition) => ex.status === 'active');
      setExhibitions(activeExhibitions);
    } catch (error) {
      console.error('Error loading exhibitions:', error);
    }
  };

  const loadGuards = async () => {
    try {
      const data = await getUsers();
      const usersList = Array.isArray(data) ? data : (data.results || []);
      // Filtriraj samo aktivne guardove
      const activeGuards = usersList.filter((u: User) => u.role === 'guard' && u.is_active);
      setGuards(activeGuards);
    } catch (error) {
      console.error('Error loading guards:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  const handleNotificationPress = (notification: AdminNotification) => {
    setSelectedNotification(notification);
    setShowActionModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      cast_type: 'broadcast',
      to_user_id: null,
      notification_date: null,
      shift_type: null,
      exhibition_id: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setCreateStep('cast_type');
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (notification: AdminNotification) => {
    setFormData({
      title: notification.title,
      message: notification.message,
      cast_type: notification.cast_type,
      to_user_id: notification.to_user?.id || null,
      notification_date: notification.notification_date,
      shift_type: notification.shift_type,
      exhibition_id: notification.exhibition?.id || null,
      expires_at: notification.expires_at,
    });
    setSelectedNotification(notification);
    setShowActionModal(false);
    setShowEditModal(true);
  };

  const handleCreate = async () => {
    console.log('=== handleCreate START ===');
    console.log('formData at start:', JSON.stringify(formData, null, 2));
    console.log('submitting:', submitting);
    
    if (!formData.title.trim() || !formData.message.trim()) {
      console.log('=== VALIDATION FAILED: title or message empty ===');
      Alert.alert('Greška', 'Naslov i poruka su obavezni');
      return;
    }

    if (formData.cast_type === 'unicast' && !formData.to_user_id) {
      console.log('=== VALIDATION FAILED: unicast without user ===');
      Alert.alert('Greška', 'Molimo odaberite čuvara');
      return;
    }

    if (formData.cast_type === 'multicast' && !formData.notification_date) {
      console.log('=== VALIDATION FAILED: multicast without date ===');
      Alert.alert('Greška', 'Za multicast obavijest morate odabrati datum');
      return;
    }

    console.log('=== VALIDATION PASSED, CREATING NOTIFICATION ===');

    setSubmitting(true);
    console.log('=== setSubmitting(true) called ===');
    
    try {
      console.log('=== Calling createAdminNotification API ===');
      const result = await createAdminNotification(formData);
      console.log('=== CREATE SUCCESS ===', result);
      Alert.alert('Uspjeh', 'Obavijest je uspješno kreirana');
      setShowCreateModal(false);
      resetForm();
      loadNotifications();
    } catch (error: any) {
      console.error('=== CREATE ERROR ===');
      console.error('Error creating notification:', error);
      console.error('Error response:', error.response?.data);
      Alert.alert('Greška', error.response?.data?.detail || 'Nije moguće kreirati obavijest');
    } finally {
      console.log('=== setSubmitting(false) in finally ===');
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedNotification) return;

    if (!formData.title.trim() || !formData.message.trim()) {
      Alert.alert('Greška', 'Naslov i poruka su obavezni');
      return;
    }

    if (formData.cast_type === 'multicast' && !formData.notification_date) {
      Alert.alert('Greška', 'Za multicast obavijest morate odabrati datum');
      return;
    }

    try {
      await updateAdminNotification(selectedNotification.id, formData);
      Alert.alert('Uspjeh', 'Obavijest je uspješno ažurirana');
      setShowEditModal(false);
      loadNotifications();
    } catch (error: any) {
      console.error('Error updating notification:', error);
      Alert.alert('Greška', error.response?.data?.detail || 'Nije moguće ažurirati obavijest');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Potvrda',
      'Jeste li sigurni da želite obrisati ovu obavijest?',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Obriši',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminNotification(id);
              Alert.alert('Uspjeh', 'Obavijest je uspješno obrisana');
              loadNotifications();
            } catch (error: any) {
              console.error('Error deleting notification:', error);
              Alert.alert('Greška', error.response?.data?.detail || 'Nije moguće obrisati obavijest');
            }
          },
        },
      ]
    );
  };

  // DateTimePicker handlers - izvučeni van da izbjegnemo probleme s inline funkcijama
  const handleNotificationDateChange = (event: any, selectedDate?: Date) => {
    console.log('=== handleNotificationDateChange CALLED ===');
    console.log('event:', JSON.stringify(event));
    console.log('selectedDate:', selectedDate);
    try {
      setShowDatePicker(false);
      if (selectedDate) {
        setFormData(prev => ({ ...prev, notification_date: selectedDate.toISOString().split('T')[0] }));
      }
    } catch (error) {
      console.error('ERROR in handleNotificationDateChange:', error);
    }
  };

  const handleExpiresDateChange = (event: any, selectedDate?: Date) => {
    console.log('=== handleExpiresDateChange CALLED ===');
    console.log('event:', JSON.stringify(event));
    console.log('selectedDate:', selectedDate);
    try {
      setShowExpiresDatePicker(false);
      if (selectedDate) {
        setFormData(prev => ({ ...prev, expires_at: selectedDate.toISOString() }));
      }
    } catch (error) {
      console.error('ERROR in handleExpiresDateChange:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCastTypeLabel = (castType: AdminNotificationCastType) => {
    switch (castType) {
      case 'broadcast': return 'Svima';
      case 'multicast': return 'Nekima';
      case 'unicast': return 'Jednoj osobi';
    }
  };

  const getShiftLabel = (shiftType: ShiftType | null | undefined) => {
    if (!shiftType) return 'Sve smjene';
    return shiftType === 'morning' ? 'Jutarnja' : 'Popodnevna';
  };

  const getSelectedGuardName = () => {
    if (!formData.to_user_id) return 'Odaberi čuvara';
    const guard = guards.find(g => g.id === formData.to_user_id);
    return guard ? guard.full_name : 'Odaberi čuvara';
  };

  const getSelectedExhibitionName = () => {
    if (!formData.exhibition_id) return 'Sve izložbe';
    const exhibition = exhibitions.find(e => e.id === formData.exhibition_id);
    return exhibition ? exhibition.name : 'Sve izložbe';
  };

  // Provjeri da li je obavijest istekla
  const isExpired = (notification: AdminNotification) => {
    return new Date(notification.expires_at) < new Date();
  };

  const renderNotificationCard = ({ item }: { item: AdminNotification }) => {
    const expired = isExpired(item);
    
    return (
      <TouchableOpacity
        style={[styles.card, expired && styles.cardExpired]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[
            styles.castBadge,
            item.cast_type === 'broadcast' && styles.castBroadcast,
            item.cast_type === 'multicast' && styles.castMulticast,
            item.cast_type === 'unicast' && styles.castUnicast,
          ]}>
            <Text style={styles.castBadgeText}>{getCastTypeLabel(item.cast_type)}</Text>
          </View>
        </View>

        <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>

        <View style={styles.cardMeta}>
          {item.created_by && (
            <Text style={styles.cardMetaText}>
              Kreirao: {item.created_by.full_name}
            </Text>
          )}
          
          {item.to_user && (
            <Text style={styles.cardMetaText}>
              Primatelj: {item.to_user.full_name}
            </Text>
          )}
          
          {item.notification_date && (
            <Text style={styles.cardMetaText}>
              Datum: {formatDate(item.notification_date)}
            </Text>
          )}
          
          {item.shift_type && (
            <Text style={styles.cardMetaText}>
              Smjena: {getShiftLabel(item.shift_type)}
            </Text>
          )}
          
          {item.exhibition && (
            <Text style={styles.cardMetaText}>
              Izložba: {item.exhibition.name}
            </Text>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.cardExpiry, expired && styles.cardExpiryExpired]}>
            {expired ? 'Istekla: ' : 'Istječe: '}{formatDateTime(item.expires_at)}
          </Text>
          <Text style={styles.cardCreated}>
            Kreirano: {formatDateTime(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCastTypeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Kome je namijenjena obavijest?</Text>
      
      <TouchableOpacity
        style={[styles.castOption, formData.cast_type === 'broadcast' && styles.castOptionSelected]}
        onPress={() => setFormData({ ...formData, cast_type: 'broadcast', to_user_id: null, notification_date: null, shift_type: null, exhibition_id: null })}
      >
        <Text style={styles.castOptionTitle}>📢 Svima</Text>
        <Text style={styles.castOptionDesc}>
          Obavijesti koje će svi čuvari vidjeti svaki dan na početnoj stranici tijekom trajanja obavijesti. 
          Namijenjeno samo najbitnijim obavijestima koje ne traju dugo.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.castOption, formData.cast_type === 'unicast' && styles.castOptionSelected]}
        onPress={() => setFormData({ ...formData, cast_type: 'unicast', notification_date: null, shift_type: null, exhibition_id: null })}
      >
        <Text style={styles.castOptionTitle}>👤 Jednoj osobi</Text>
        <Text style={styles.castOptionDesc}>
          Obavijest namijenjena specifičnom čuvaru.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.castOption, formData.cast_type === 'multicast' && styles.castOptionSelected]}
        onPress={() => setFormData({ ...formData, cast_type: 'multicast', to_user_id: null })}
      >
        <Text style={styles.castOptionTitle}>👥 Nekima</Text>
        <Text style={styles.castOptionDesc}>
          Obavijest namijenjena čuvarima koji zadovoljavaju određene uvjete (datum, smjena, izložba).
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => {
          if (formData.cast_type === 'broadcast') {
            setCreateStep('content');
          } else if (formData.cast_type === 'unicast') {
            setCreateStep('filters');
          } else {
            setCreateStep('filters');
          }
        }}
      >
        <Text style={styles.nextButtonText}>Dalje</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFiltersStep = () => (
    <View style={styles.stepContainer}>
      {formData.cast_type === 'unicast' ? (
        <>
          <Text style={styles.stepTitle}>Odaberi čuvara</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Čuvar *</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowGuardDropdown(true)}
            >
              <Text style={styles.pickerText}>{getSelectedGuardName()}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.stepTitle}>Filtriraj primatelje</Text>
          <Text style={styles.stepHint}>
            Datum je obavezan. Izložba i smjena su opcionalni filteri.
          </Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Datum *</Text>
            <Text style={styles.helperText}>Odaberite datum za koji želite poslati obavijest.</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={formData.notification_date || ''}
                onChange={(e) => setFormData({ ...formData, notification_date: e.target.value || null })}
                style={{
                  padding: 14,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #839958',
                  backgroundColor: '#F7F4D5',
                  color: '#839958',
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => {
                    console.log('=== OPENING DATE PICKER (notification_date) ===');
                    console.log('formData.notification_date:', formData.notification_date);
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.pickerText}>
                    {formData.notification_date ? formatDate(formData.notification_date) : 'Odaberi datum'}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={formData.notification_date ? new Date(formData.notification_date) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleNotificationDateChange}
                  />
                )}
              </>
            )}
            {formData.notification_date && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setFormData({ ...formData, notification_date: null })}
              >
                <Text style={styles.clearButtonText}>Očisti datum</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Izložba</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowExhibitionDropdown(true)}
            >
              <Text style={styles.pickerText}>{getSelectedExhibitionName()}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Smjena</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowShiftDropdown(true)}
            >
              <Text style={styles.pickerText}>{getShiftLabel(formData.shift_type)}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log('=== NAZAD PRESSED (filters step) ===');
            setCreateStep('cast_type');
          }}
        >
          <Text style={styles.backButtonText}>← Nazad</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.nextButton,
            formData.cast_type === 'unicast' && !formData.to_user_id && styles.buttonDisabled
          ]}
          onPress={() => {
            console.log('=== DALJE PRESSED (filters -> content) ===');
            console.log('notification_date:', formData.notification_date);
            setCreateStep('content');
          }}
          disabled={formData.cast_type === 'unicast' && !formData.to_user_id}
        >
          <Text style={styles.nextButtonText}>Dalje</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContentStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Sadržaj obavijesti</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Naslov *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => setFormData({ ...formData, title: text })}
          placeholder="Unesite naslov obavijesti"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Poruka *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.message}
          onChangeText={(text) => setFormData({ ...formData, message: text })}
          placeholder="Unesite tekst obavijesti"
          multiline
          numberOfLines={6}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Datum isteka</Text>
        {Platform.OS === 'web' ? (
          <input
            type="datetime-local"
            value={formData.expires_at.slice(0, 16)}
            onChange={(e) => setFormData({ ...formData, expires_at: new Date(e.target.value).toISOString() })}
            style={{
              padding: 14,
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #839958',
              backgroundColor: '#F7F4D5',
              color: '#839958',
            }}
          />
        ) : (
          <>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowExpiresDatePicker(true)}
            >
              <Text style={styles.pickerText}>
                {formatDateTime(formData.expires_at)}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {showExpiresDatePicker && (
              <DateTimePicker
                value={new Date(formData.expires_at)}
                mode="date"
                display="default"
                onChange={handleExpiresDateChange}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (formData.cast_type === 'broadcast') {
              setCreateStep('cast_type');
            } else {
              setCreateStep('filters');
            }
          }}
        >
          <Text style={styles.backButtonText}>← Nazad</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!formData.title.trim() || !formData.message.trim() || submitting) && styles.buttonDisabled
          ]}
          onPress={() => {
            console.log('=== BUTTON PRESSED ===');
            console.log('title:', formData.title);
            console.log('message:', formData.message);
            console.log('submitting:', submitting);
            console.log('disabled check:', !formData.title.trim() || !formData.message.trim() || submitting);
            handleCreate();
          }}
          disabled={!formData.title.trim() || !formData.message.trim() || submitting}
        >
          <Text style={styles.submitButtonText}>{submitting ? 'Šaljem...' : 'Kreiraj obavijest'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEditForm = () => (
    <ScrollView style={styles.modalContent}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Tip obavijesti</Text>
        <Text style={styles.readOnlyText}>{getCastTypeLabel(formData.cast_type)}</Text>
      </View>

      {formData.cast_type === 'unicast' && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>Čuvar</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowGuardDropdown(true)}
          >
            <Text style={styles.pickerText}>{getSelectedGuardName()}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      {formData.cast_type === 'multicast' && (
        <>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Datum *</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={formData.notification_date || ''}
                onChange={(e) => setFormData({ ...formData, notification_date: e.target.value || null })}
                style={{
                  padding: 14,
                  fontSize: 16,
                  borderRadius: 8,
                  border: '1px solid #839958',
                  backgroundColor: '#F7F4D5',
                  color: '#839958',
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {formData.notification_date ? formatDate(formData.notification_date) : 'Odaberi datum'}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={formData.notification_date ? new Date(formData.notification_date) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleNotificationDateChange}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Izložba</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowExhibitionDropdown(true)}
            >
              <Text style={styles.pickerText}>{getSelectedExhibitionName()}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Smjena</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowShiftDropdown(true)}
            >
              <Text style={styles.pickerText}>{getShiftLabel(formData.shift_type)}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.formGroup}>
        <Text style={styles.label}>Naslov *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => setFormData({ ...formData, title: text })}
          placeholder="Unesite naslov obavijesti"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Poruka *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.message}
          onChangeText={(text) => setFormData({ ...formData, message: text })}
          placeholder="Unesite tekst obavijesti"
          multiline
          numberOfLines={6}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Datum isteka</Text>
        {Platform.OS === 'web' ? (
          <input
            type="datetime-local"
            value={formData.expires_at.slice(0, 16)}
            onChange={(e) => setFormData({ ...formData, expires_at: new Date(e.target.value).toISOString() })}
            style={{
              padding: 14,
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #839958',
              backgroundColor: '#F7F4D5',
              color: '#839958',
            }}
          />
        ) : (
          <>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowExpiresDatePicker(true)}
            >
              <Text style={styles.pickerText}>
                {formatDateTime(formData.expires_at)}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {showExpiresDatePicker && (
              <DateTimePicker
                value={new Date(formData.expires_at)}
                mode="date"
                display="default"
                onChange={handleExpiresDateChange}
              />
            )}
          </>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          styles.submitButtonFull,
          (!formData.title.trim() || !formData.message.trim()) && styles.buttonDisabled
        ]}
        onPress={handleEdit}
        disabled={!formData.title.trim() || !formData.message.trim()}
      >
        <Text style={styles.submitButtonText}>Spremi promjene</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
<ActivityIndicator size="large" color="#0A3323" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerButtons}>
          {isAdmin && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={openCreateModal}
            >
              <Text style={styles.createButtonText}>+ Kreiraj obavijest</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={openFiltersModal}
          >
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista obavijesti */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nema obavijesti</Text>
          </View>
        }
      />

      {/* Pagination Controls */}
      {!loading && (prev || next) && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity 
            style={[styles.paginationButton, !prev && styles.paginationButtonDisabled]}
            onPress={() => {
              if (prev) {
                const newPage = Math.max(1, page - 1);
                setPage(newPage);
                loadNotifications(newPage);
              }
            }}
            disabled={!prev}
          >
            <Text style={[styles.paginationButtonText, !prev && styles.paginationButtonTextDisabled]}>
              Prethodna
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.paginationText}>Stranica {page}</Text>
          
          <TouchableOpacity 
            style={[styles.paginationButton, !next && styles.paginationButtonDisabled]}
            onPress={() => {
              if (next) {
                const newPage = page + 1;
                setPage(newPage);
                loadNotifications(newPage);
              }
            }}
            disabled={!next}
          >
            <Text style={[styles.paginationButtonText, !next && styles.paginationButtonTextDisabled]}>
              Sljedeća
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter/Sort Modal */}
      <Modal visible={showFiltersModal} transparent animationType="slide">
        <View style={styles.filterModalOverlay}>
          <View style={styles.filtersModalContent}>
            <Text style={styles.modalTitle}>Filteri i sortiranje</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* FILTERI */}
              {isAdmin && (
                <View style={styles.filterSection}>
                  <Text style={styles.sectionTitle}>🔍 FILTERI</Text>
                  
                  <Text style={styles.label}>Pokazuj</Text>
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity 
                      style={styles.picker}
                      onPress={() => setShowActiveDropdown(true)}
                    >
                      <Text style={styles.pickerText}>
                        {tempActiveFilter ? 'Samo aktivne obavijesti' : 'Sve obavijesti'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* SORTIRANJE */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>📊 SORTIRANJE</Text>
                
                <Text style={styles.label}>Sortiraj po</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowSortDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortField === 'created_at' ? 'Datum kreiranja' : 'Datum isteka'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Redoslijed</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity 
                    style={styles.picker}
                    onPress={() => setShowOrderDropdown(true)}
                  >
                    <Text style={styles.pickerText}>
                      {tempSortOrder === 'asc' ? '↑ Uzlazno (starije prvo)' : '↓ Silazno (novije prvo)'}
                    </Text>
                    <Text style={styles.pickerArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            
            {/* BUTTONS */}
            <View style={styles.filtersModalFooter}>
              <TouchableOpacity
                style={styles.filterCancelButton}
                onPress={cancelFilters}
              >
                <Text style={styles.filterCancelButtonText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={applyFilters}
              >
                <Text style={styles.filterApplyButtonText}>✓ Primijeni</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Active Filter Dropdown */}
      <Modal visible={showActiveDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowActiveDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Prikaži</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempActiveFilter && styles.dropdownItemActive]}
              onPress={() => {
                setTempActiveFilter(true);
                setShowActiveDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempActiveFilter && styles.dropdownItemTextActive]}>
                Samo aktivne obavijesti
              </Text>
              {tempActiveFilter && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, !tempActiveFilter && styles.dropdownItemActive]}
              onPress={() => {
                setTempActiveFilter(false);
                setShowActiveDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, !tempActiveFilter && styles.dropdownItemTextActive]}>
                Sve obavijesti
              </Text>
              {!tempActiveFilter && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Field Dropdown */}
      <Modal visible={showSortDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowSortDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Sortiraj po</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortField === 'created_at' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortField('created_at');
                setShowSortDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortField === 'created_at' && styles.dropdownItemTextActive]}>
                Datum kreiranja
              </Text>
              {tempSortField === 'created_at' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortField === 'expires_at' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortField('expires_at');
                setShowSortDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortField === 'expires_at' && styles.dropdownItemTextActive]}>
                Datum isteka
              </Text>
              {tempSortField === 'expires_at' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Order Dropdown */}
      <Modal visible={showOrderDropdown} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowOrderDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Redoslijed</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'desc' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortOrder('desc');
                setShowOrderDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'desc' && styles.dropdownItemTextActive]}>
                ↓ Silazno (novije prvo)
              </Text>
              {tempSortOrder === 'desc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, tempSortOrder === 'asc' && styles.dropdownItemActive]}
              onPress={() => {
                setTempSortOrder('asc');
                setShowOrderDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, tempSortOrder === 'asc' && styles.dropdownItemTextActive]}>
                ↑ Uzlazno (starije prvo)
              </Text>
              {tempSortOrder === 'asc' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.actionModalContent}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                if (selectedNotification) {
                  openEditModal(selectedNotification);
                }
              }}
            >
              <Text style={styles.actionButtonIcon}>✏️</Text>
              <Text style={styles.actionButtonText}>Uredi obavijest</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDelete]}
              onPress={() => {
                setShowActionModal(false);
                if (selectedNotification) {
                  handleDelete(selectedNotification.id);
                }
              }}
            >
              <Text style={styles.actionButtonIcon}>🗑️</Text>
              <Text style={styles.actionButtonTextDelete}>Obriši</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonCancel}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.actionButtonCancelText}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nova obavijest</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {createStep === 'cast_type' && renderCastTypeStep()}
            {createStep === 'filters' && renderFiltersStep()}
            {createStep === 'content' && renderContentStep()}
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Uredi obavijest</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {renderEditForm()}
        </View>
      </Modal>

      {/* Guard Dropdown Modal */}
      <Modal visible={showGuardDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowGuardDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Odaberi čuvara</Text>
            <ScrollView style={styles.dropdownScroll}>
              {guards.map(guard => (
                <TouchableOpacity
                  key={guard.id}
                  style={[styles.dropdownItem, formData.to_user_id === guard.id && styles.dropdownItemActive]}
                  onPress={() => {
                    setFormData({ ...formData, to_user_id: guard.id });
                    setShowGuardDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, formData.to_user_id === guard.id && styles.dropdownItemTextActive]}>
                    {guard.full_name}
                  </Text>
                  {formData.to_user_id === guard.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Exhibition Dropdown Modal */}
      <Modal visible={showExhibitionDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowExhibitionDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Odaberi izložbu</Text>
            <ScrollView style={styles.dropdownScroll}>
              <TouchableOpacity
                style={[styles.dropdownItem, formData.exhibition_id === null && styles.dropdownItemActive]}
                onPress={() => {
                  setFormData({ ...formData, exhibition_id: null });
                  setShowExhibitionDropdown(false);
                }}
              >
                <Text style={[styles.dropdownItemText, formData.exhibition_id === null && styles.dropdownItemTextActive]}>
                  Sve izložbe
                </Text>
                {formData.exhibition_id === null && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              {exhibitions.map(exhibition => (
                <TouchableOpacity
                  key={exhibition.id}
                  style={[styles.dropdownItem, formData.exhibition_id === exhibition.id && styles.dropdownItemActive]}
                  onPress={() => {
                    setFormData({ ...formData, exhibition_id: exhibition.id });
                    setShowExhibitionDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, formData.exhibition_id === exhibition.id && styles.dropdownItemTextActive]}>
                    {exhibition.name}
                  </Text>
                  {formData.exhibition_id === exhibition.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Shift Dropdown Modal */}
      <Modal visible={showShiftDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowShiftDropdown(false)}
        >
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownTitle}>Odaberi smjenu</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, formData.shift_type === null && styles.dropdownItemActive]}
              onPress={() => {
                setFormData({ ...formData, shift_type: null });
                setShowShiftDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, formData.shift_type === null && styles.dropdownItemTextActive]}>
                Sve smjene
              </Text>
              {formData.shift_type === null && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, formData.shift_type === 'morning' && styles.dropdownItemActive]}
              onPress={() => {
                setFormData({ ...formData, shift_type: 'morning' });
                setShowShiftDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, formData.shift_type === 'morning' && styles.dropdownItemTextActive]}>
                Jutarnja
              </Text>
              {formData.shift_type === 'morning' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dropdownItem, formData.shift_type === 'afternoon' && styles.dropdownItemActive]}
              onPress={() => {
                setFormData({ ...formData, shift_type: 'afternoon' });
                setShowShiftDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, formData.shift_type === 'afternoon' && styles.dropdownItemTextActive]}>
                Popodnevna
              </Text>
              {formData.shift_type === 'afternoon' && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#0A3323',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#839958',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  createButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#839958',
  },
  createButtonText: {
    color: '#839958',
    fontSize: 16,
    fontWeight: '600',
  },
  filterIconButton: {
    backgroundColor: '#F7F4D5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    fontSize: 20,
  },
  listContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: '#0A3323',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0A3323',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardExpired: {
    opacity: 0.6,
    backgroundColor: '#D3968C',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#839958',
    flex: 1,
    marginRight: 10,
  },
  castBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  castBroadcast: {
    backgroundColor: '#105666',
  },
  castMulticast: {
    backgroundColor: '#839958',
  },
  castUnicast: {
    backgroundColor: '#D3968C',
  },
  castBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F7F4D5',
  },
  cardMessage: {
    fontSize: 14,
    color: '#839958',
    marginBottom: 10,
  },
  cardMeta: {
    marginBottom: 10,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#D3968C',
    marginBottom: 2,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#839958',
    paddingTop: 10,
  },
  cardExpiry: {
    fontSize: 12,
    color: '#839958',
  },
  cardExpiryExpired: {
    color: '#D3968C',
  },
  cardCreated: {
    fontSize: 12,
    color: '#D3968C',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#839958',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#839958',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  actionButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#839958',
  },
  actionButtonDelete: {
    borderBottomWidth: 0,
  },
  actionButtonTextDelete: {
    fontSize: 16,
    color: '#D3968C',
  },
  actionButtonCancel: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonCancelText: {
    fontSize: 16,
    color: '#D3968C',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F4D5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#839958',
  },
  closeButton: {
    fontSize: 24,
    color: '#839958',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#839958',
  },
  stepHint: {
    fontSize: 14,
    color: '#D3968C',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  castOption: {
    backgroundColor: '#0A3323',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  castOptionSelected: {
    borderColor: '#105666',
    backgroundColor: '#105666',
  },
  castOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#839958',
  },
  castOptionDesc: {
    fontSize: 14,
    color: '#839958',
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#839958',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#D3968C',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#0A3323',
    color: '#839958',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#839958',
    padding: 12,
    backgroundColor: '#0A3323',
    borderRadius: 8,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#839958',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#0A3323',
  },
  pickerText: {
    fontSize: 16,
    color: '#839958',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#839958',
  },
  clearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#D3968C',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  nextButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#839958',
  },
  nextButtonText: {
    color: '#839958',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#F7F4D5',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#839958',
  },
  backButtonText: {
    color: '#839958',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0A3323',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#839958',
  },
  submitButtonFull: {
    marginLeft: 0,
    marginTop: 10,
    marginBottom: 30,
  },
  submitButtonText: {
    color: '#839958',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 51, 35, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#F7F4D5',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 350,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#839958',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#839958',
  },
  dropdownScroll: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#839958',
  },
  dropdownItemActive: {
    backgroundColor: '#105666',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#839958',
  },
  dropdownItemTextActive: {
    color: '#F7F4D5',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#105666',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F7F4D5',
    borderTopWidth: 1,
    borderTopColor: '#839958',
  },
  paginationButton: {
    backgroundColor: '#0A3323',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#D3968C',
  },
  paginationButtonText: {
    color: '#839958',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationButtonTextDisabled: {
    color: '#F7F4D5',
  },
  paginationText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#839958',
  },
  // Filter Modal styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filtersModalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  filterSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 15,
    color: '#333',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  filtersModalFooter: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
    gap: 10,
  },
  filterCancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterCancelButtonText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 17,
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 17,
  },});