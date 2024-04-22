import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, of, Subscription } from 'rxjs';
import { map, catchError, switchMap, finalize } from 'rxjs/operators';
import { UserModel } from '../models/user.model';
import { AuthModel } from '../models/auth.model';
import { AuthHTTPService } from './auth-http';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { URL_BACKEND_SERVICES } from 'src/app/config/config';

export type UserType = any | undefined;

@Injectable({
    providedIn: 'root',
})
export class AuthService implements OnDestroy {
    // private fields
    private unsubscribe: Subscription[] = []; // Read more: => https://brianflove.com/2016/12/11/anguar-2-unsubscribe-observables/
    private authLocalStorageToken = `${environment.appVersion}-${environment.USERDATA_KEY}`;

    user:any = null;
    token:any = null;

    // public fields
    currentUser$: Observable<any>;
    isLoading$: Observable<boolean>;
    currentUserSubject: BehaviorSubject<any>;
    isLoadingSubject: BehaviorSubject<boolean>;

    get currentUserValue(): any {
        return this.currentUserSubject.value;
    }

    set currentUserValue(user: any) {
        this.currentUserSubject.next(user);
    }

    constructor(
        private authHttpService: AuthHTTPService,
        private router: Router,
        private http: HttpClient
    ) {
        this.isLoadingSubject = new BehaviorSubject<boolean>(false);
        this.currentUserSubject = new BehaviorSubject<any>(undefined);
        this.currentUser$ = this.currentUserSubject.asObservable();
        this.isLoading$ = this.isLoadingSubject.asObservable();
        const subscr = this.getUserByToken().subscribe();
        this.unsubscribe.push(subscr);
    }

    // public methods
    login(email: string, password: string): Observable<any> {

        this.isLoadingSubject.next(true);

        return this.http.post(
            `${URL_BACKEND_SERVICES}/auth/login`,
            { email, password }).pipe(
            map((auth: any) => {
                const result = this.setAuthFromLocalStorage(auth);
                this.currentUserSubject.next(auth);
                return result;
            }),

            catchError((err) => {
                console.error('err', err);
                return of(undefined);
            }),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        this.router.navigate(['/auth/login'], {
            queryParams: {},
        });
    }

    getUserByToken(): Observable<any> {
        const auth = this.getAuthFromLocalStorage();
        if (!auth) {
            return of(undefined);
        }

        this.isLoadingSubject.next(true);

        return of(auth).pipe(
            map((user: any) => {
                if (user) {
                    console.log('>>> YESS auth service getUserByToken -> if (user)')
                    this.currentUserValue = user;
                } else {
                    // NOTE: por acá?
                    console.log('>>> auth service getUserByToken -> if (user)')
                    this.logout();
                }
                return user;
            }),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    // need create new user then login
    registration(user: UserModel): Observable<any> {

        this.isLoadingSubject.next(true);

        return this.authHttpService.createUser(user).pipe(
            map(() => {
                this.isLoadingSubject.next(false);
            }),
            switchMap(() => this.login(user.email, user.password)),
            catchError((err) => {
                console.error('err', err);
                return of(undefined);
            }),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    forgotPassword(email: string): Observable<boolean> {
        this.isLoadingSubject.next(true);
        return this.authHttpService
            .forgotPassword(email)
            .pipe(finalize(() => this.isLoadingSubject.next(false)));
    }

    // private methods
    private setAuthFromLocalStorage(auth: any): boolean {
        // store auth access_token/refreshToken/epiresIn in local storage to keep user logged in between page refreshes
        if (auth && auth.user && auth.access_token) {
            localStorage.setItem('user', JSON.stringify(auth.user));
            localStorage.setItem('token', auth.access_token);

            return true;
        }
        return false;
    }

    private getAuthFromLocalStorage(): any {
        try {
            const lsValue = localStorage.getItem('user');

            if (!lsValue) {
                return undefined;
            }

            this.token = localStorage.getItem('token')
            this.user =  JSON.parse(lsValue)
            const authData = JSON.parse(lsValue);

            return authData;
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    ngOnDestroy() {
        this.unsubscribe.forEach((sb) => sb.unsubscribe());
    }
}
