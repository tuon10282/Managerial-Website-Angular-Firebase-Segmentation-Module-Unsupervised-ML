import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Feedback } from '../../classes/Feedback';

interface ColumnFilter {
  searchTerm: string;
  selectedValues: Set<string>;
  isDropdownOpen: boolean;
  uniqueValues: string[];
}

@Component({
  selector: 'app-feedback',
  standalone: false,
  templateUrl: 'feedback.component.html',
  styleUrl: './feedback.component.css'
})
export class FeedbackComponent implements OnInit {
  feedbacks: Feedback[] = [];
  filteredFeedbacks: Feedback[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  error: string | null = null;

  isModalOpen: boolean = false;
  selectedFeedback: Feedback | null = null;
  editingFeedback: Feedback | null = null;
  isEditing: boolean = false;

  // Consistent collection name
  private readonly COLLECTION_NAME = 'product_feedback';

  filters: { [key: string]: ColumnFilter } = {
    feedback_id: this.initFilter(),
    user_id: this.initFilter(),
    product_id: this.initFilter(),
    content: this.initFilter(),
    ratings: this.initFilter(),
    created_at: this.initFilter(),
  };

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    this.loadFeedbacks();
  }

  private loadFeedbacks(): void {
    this.loading = true;
    this.error = null;
    
    const feedbackRef = collection(this.firestore, this.COLLECTION_NAME);

    collectionData(feedbackRef, { idField: 'feedback_id' }).subscribe({
      next: (data: any[]) => {
        try {
          this.feedbacks = data.map(feedback => new Feedback(
            feedback.feedback_id,
            feedback.user_id,
            feedback.product_id,
            feedback.content,
            feedback.ratings,
            this.formatFirestoreDate(feedback.created_at)
          ));
          this.initializeFilters();
          this.applyFilters();
        } catch (error) {
          console.error('Error processing feedback data:', error);
          this.error = 'Error processing feedback data';
        } finally {
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = 'Failed to load feedbacks';
        this.loading = false;
        console.error('Firestore error:', err);
      }
    });
  }

  parseFirestoreDate(input: any): Date | null {
    if (!input) return null;
    if (input.toDate) return input.toDate();
    if (input.seconds) return new Date(input.seconds * 1000);
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  formatFirestoreDate(input: any): string {
    const date = this.parseFirestoreDate(input);
    if (!date) return '';
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
  }

  formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  initFilter(): ColumnFilter {
    return {
      searchTerm: '',
      selectedValues: new Set(),
      isDropdownOpen: false,
      uniqueValues: []
    };
  }

  normalizeVietnameseText(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
  }

  openModal(feedback: Feedback): void {
    this.selectedFeedback = { ...feedback };
    this.editingFeedback = { ...feedback };
    this.isModalOpen = true;
    this.isEditing = false;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedFeedback = null;
    this.editingFeedback = null;
    this.isEditing = false;
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.selectedFeedback) {
      this.editingFeedback = { ...this.selectedFeedback };
    }
  }

  async saveFeedback(): Promise<void> {
    if (!this.editingFeedback || !this.selectedFeedback) {
      console.error('No feedback data to save');
      return;
    }

    try {
      // Update local data first
      const index = this.feedbacks.findIndex(f => f.feedback_id === this.selectedFeedback!.feedback_id);
      if (index !== -1) {
        this.feedbacks[index] = { ...this.editingFeedback };
        this.selectedFeedback = { ...this.editingFeedback };
        
        this.initializeFilters();
        this.applyFilters();
      }

      // Prepare data for Firestore update - use consistent collection name
      const feedbackRef = doc(this.firestore, `${this.COLLECTION_NAME}/${this.selectedFeedback.feedback_id}`);
      const dataToUpdate = this.removeUndefinedFields(this.editingFeedback);

      console.log('📦 Feedback data to update:', dataToUpdate);

      // Update Firestore
      await updateDoc(feedbackRef, dataToUpdate);
      console.log('✅ Feedback updated successfully');
      
      this.isEditing = false;
      this.showSuccessMessage('Cập nhật phản hồi thành công!');
      
    } catch (error) {
      console.error('❌ Error updating feedback:', error);
      this.showErrorMessage('Có lỗi xảy ra khi cập nhật phản hồi');
      
      // Revert local changes on error
      this.loadFeedbacks();
    }
  }

  removeUndefinedFields(obj: any): any {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined && value !== null)
    );
  }

  deleteFeedbackFromModal(): void {
    if (this.selectedFeedback && confirm('Bạn có chắc chắn muốn xóa phản hồi này?')) {
      this.deleteFeedback(this.selectedFeedback.feedback_id);
      this.closeModal();
    }
  }

  async deleteFeedback(feedbackId: string): Promise<void> {
    if (!feedbackId) {
      console.error('No feedback ID provided for deletion');
      return;
    }

    try {
      // Delete from Firestore first - use consistent collection name
      const feedbackRef = doc(this.firestore, `${this.COLLECTION_NAME}/${feedbackId}`);
      await deleteDoc(feedbackRef);
      console.log('✅ Feedback deleted from Firestore successfully');

      // Update local data after successful deletion
      this.feedbacks = this.feedbacks.filter(f => f.feedback_id !== feedbackId);
      this.initializeFilters();
      this.applyFilters();

      this.showSuccessMessage('Xóa phản hồi thành công!');
    } catch (error) {
      console.error('❌ Error deleting feedback:', error);
      this.showErrorMessage('Có lỗi xảy ra khi xóa phản hồi');
    }
  }

  private showSuccessMessage(message: string): void {
    // Replace with your preferred notification system
    alert(message);
  }

  private showErrorMessage(message: string): void {
    // Replace with your preferred notification system
    alert(message);
  }

  initializeFilters() {
    const keys = Object.keys(this.filters);
    for (let key of keys) {
      this.filters[key].uniqueValues = [...new Set(this.feedbacks.map(f => this.getFeedbackValue(f, key)))];
      this.filters[key].selectedValues = new Set(this.filters[key].uniqueValues);
    }
  }

  getFeedbackValue(feedback: Feedback, column: string): string {
    switch (column) {
      case 'feedback_id': return feedback.feedback_id?.toString() || '';
      case 'user_id': return feedback.user_id?.toString() || '';
      case 'product_id': return feedback.product_id?.toString() || '';
      case 'content': return feedback.content || '';
      case 'ratings': return feedback.ratings?.toString() || '';
      case 'created_at': return feedback.created_at || '';
      default: return '';
    }
  }

  applyFilters() {
    this.filteredFeedbacks = this.feedbacks.filter(feedback => {
      return Object.keys(this.filters).every(column => {
        const value = this.getFeedbackValue(feedback, column);
        return this.filters[column].selectedValues.has(value);
      });
    });
  }

  viewFeedbackDetails(feedback: Feedback): void {
    this.openModal(feedback);
  }

  toggleFilterDropdown(column: string, event: Event) {
    event.stopPropagation();
    Object.keys(this.filters).forEach(key => 
      this.filters[key].isDropdownOpen = key === column ? !this.filters[key].isDropdownOpen : false
    );
  }

  closeAllDropdowns() {
    Object.keys(this.filters).forEach(key => this.filters[key].isDropdownOpen = false);
  }

  onSearchChange(column: string, searchTerm: string) {
    this.filters[column].searchTerm = searchTerm;
    this.applyFilters();
  }

  toggleValue(column: string, value: string) {
    const selected = this.filters[column].selectedValues;
    selected.has(value) ? selected.delete(value) : selected.add(value);
    this.applyFilters();
  }

  selectAll(column: string) {
    this.filters[column].selectedValues = new Set(this.getFilteredUniqueValues(column));
    this.applyFilters();
  }

  deselectAll(column: string) {
    this.filters[column].selectedValues.clear();
    this.applyFilters();
  }

  getFilteredUniqueValues(column: string): string[] {
    const searchTerm = this.normalizeVietnameseText(this.filters[column].searchTerm);
    return this.filters[column].uniqueValues.filter(value => 
      this.normalizeVietnameseText(value).includes(searchTerm)
    );
  }

  clearFilter(column: string) {
    this.filters[column].searchTerm = '';
    this.filters[column].selectedValues = new Set(this.filters[column].uniqueValues);
    this.applyFilters();
  }

  hasActiveFilter(column: string): boolean {
    return this.filters[column].selectedValues.size !== this.filters[column].uniqueValues.length;
  }

  // Utility methods for ratings display
  getRatingStars(rating: number): string {
    const fullStars = '★'.repeat(Math.floor(rating));
    const halfStar = rating % 1 >= 0.5 ? '☆' : '';
    const emptyStars = '☆'.repeat(5 - Math.ceil(rating));
    return fullStars + halfStar + emptyStars;
  }

  getRatingClass(rating: number): string {
    if (rating >= 4) return 'rating-excellent';
    if (rating >= 3) return 'rating-good';
    if (rating >= 2) return 'rating-average';
    return 'rating-poor';
  }

  getContentPreview(content: string, maxLength: number = 50): string {
    if (!content) return '';
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  }
}