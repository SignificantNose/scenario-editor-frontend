import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthApiService } from 'core/services/auth/auth-api.service';
import { AuthService } from 'core/services/auth/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { RoutePaths } from 'app/app.router-path';
import { AppConfigService } from 'core/services/config/app-config.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatToolbarModule,
    MatSnackBarModule
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent implements OnInit, OnDestroy {
  hidePassword = true;
  loading = false;
  private destroy$ = new Subject();
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private appConfigService = inject(AppConfigService);

  form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor(
    private authApiService: AuthApiService,
    private authService: AuthService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.authService.checkAuth().pipe(takeUntil(this.destroy$)).subscribe({
      next: (isAuthenticated) => {
        if (isAuthenticated) {
          this.router.navigate(['/']).then();
        } else {
          this.authService.logout().subscribe();
        }
      },
      error: () => {
        this.authService.logout().subscribe();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  login() {
    const { login, password } = this.form.value;
    if (!login || !password) return;

    this.loading = true;
    this.authApiService
      .login({ login, password })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(['/']).then();
        },
        error: (err) => {
          this.loading = false;
          this.snackBar.open('Login failed. Please check your credentials.', 'Close', {
            duration: 5000,
          });
        },
      });
  }

  loginWithGoogle(): void {
    this.loading = true;
    const oauthStartUrl = `${this.appConfigService.config?.apiUrl ?? ''}/api/v1/auth/oauth2/start`;
    window.location.assign(oauthStartUrl);
  }

  goToSignUp() {
    this.router.navigate([`/${RoutePaths.SignUp}`]);
  }
}
