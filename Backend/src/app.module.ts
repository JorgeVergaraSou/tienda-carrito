//src/app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ContactModule } from './contact/contact.module';
import { OrdersModule } from './orders/orders.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/winston.config';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Esto hace que la configuración esté disponible en todo el proyecto
      // Si falta o está vacía alguna de estas variables, la app no arranca
      // — mejor eso que arrancar "silenciosamente" con un JWT firmado con
      // secreto undefined, o intentar conectar a una base sin credenciales.
      validationSchema: Joi.object({
        DB_TYPE: Joi.string().default('mysql'),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().allow('').required(),
        DB_NAME: Joi.string().required(),
        SECRET_WORD: Joi.string().min(16).required(),
        MAIL_HOST: Joi.string().default('smtp.gmail.com'),
        MAIL_PORT: Joi.number().default(465),
        MAIL_USER: Joi.string().allow('').optional(),
        MAIL_PASSWORD: Joi.string().allow('').optional(),
        MAIL_FROM_NAME: Joi.string().allow('').optional(),
        FRONTEND_URL: Joi.string().uri().optional(),
        CORS_ORIGIN: Joi.string().allow('').optional(),
        // cantidad de proxies inversos de confianza delante de la app (ver
        // configureApp en app.setup.ts) — sin definir, no se confía en
        // X-Forwarded-For
        TRUST_PROXY: Joi.string().allow('').optional(),
        PORT: Joi.number().default(3006),
        SEED_ADMIN_NICK: Joi.string().allow('').optional(),
        SEED_ADMIN_EMAIL: Joi.string().allow('').optional(),
        SEED_ADMIN_PASSWORD: Joi.string().allow('').optional(),
        // Checkout Pro (ver OrdersModule/MercadoPagoModule) — opcional a
        // propósito, igual que MAIL_USER/MAIL_PASSWORD: sin esto configurado
        // el resto de la app arranca igual, MercadoPagoService recién tira
        // un error claro cuando alguien intenta pagar. MERCADOPAGO_SANDBOX
        // controla si se devuelve sandbox_init_point (default, cuentas de
        // prueba) o init_point (cuenta real de producción).
        MERCADOPAGO_ACCESS_TOKEN: Joi.string().allow('').optional(),
        MERCADOPAGO_SANDBOX: Joi.boolean().default(true),
        // URL pública por la que Mercado Pago nos avisa que un pago
        // cambió de estado (ver OrdersController.webhook) — opcional,
        // sin configurar el pedido igual se puede pagar, solo que nunca
        // nos enteramos de la confirmación por este canal (hay que
        // consultarlo a mano). localhost no sirve: tiene que ser una URL
        // alcanzable desde internet (un túnel tipo ngrok en dev).
        MERCADOPAGO_WEBHOOK_URL: Joi.string().uri().allow('').optional(),
      }),
      validationOptions: {
        abortEarly: false, // reporta todas las variables faltantes juntas, no solo la primera
      },
    }),
    // Registrar WinstonModule globalmente con tu configuración
    WinstonModule.forRoot(winstonConfig),

    // Límite base para las rutas que usen @Throttle() (login,
    // requestResetPassword, contacto, pedidos, webhook). No aplica solo,
    // cada ruta lo activa con @UseGuards(ThrottlerGuard).
    //
    // 'login' es un segundo contador SOLO para POST /auth/login: cuenta por
    // IP + nickUsuario (5 por minuto). Así 5 claves malas contra "maria" no
    // bloquean el login de "juan" desde la misma red (un local con un solo
    // router), y aun así no se pueden probar más de 5 claves por minuto
    // contra una misma cuenta. El contador 'default' (por IP, más alto)
    // sigue frenando a quien recorre muchos usuarios distintos desde una IP.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60000, limit: 20 },
        {
          name: 'login',
          ttl: 60000,
          limit: 5,
          skipIf: (context) => context.getHandler().name !== 'login',
          getTracker: (req) => {
            const nick =
              typeof req.body?.nickUsuario === 'string'
                ? req.body.nickUsuario.trim().toLowerCase()
                : 'sin-usuario';
            return `${req.ip}-${nick}`;
          },
        },
      ],
      errorMessage:
        'Demasiados intentos. Esperá un momento antes de volver a intentar.',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // 🔍 Log para verificar que las variables se leen bien (sin exponer la
        // contraseña en la consola / archivos de log)
        console.log({
          type: configService.get('DB_TYPE'),
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
          username: configService.get('DB_USERNAME'),
          database: configService.get('DB_NAME'),
        });

        // ⚙️ Retornás la configuración para TypeORM
        return {
          type: configService.get<'mysql'>('DB_TYPE'),
          host: configService.get<string>('DB_HOST'),
          port: Number(configService.get<string>('DB_PORT')),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          autoLoadEntities: true,
          synchronize: true,
          timezone: '-03:00',
          dateStrings: ['DATE'],
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    ProductsModule,
    CategoriesModule,
    ContactModule,
    OrdersModule,
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule {}
